#!/usr/bin/env python3
"""
Kanji Database API Server
Complete kanji reference with Jouyou and Jinmeiyou kanji
"""

import json
import os
import sqlite3
import subprocess
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Database setup
# Database setup
default_db_path = os.path.join(os.path.dirname(__file__), "..", "data", "kanji.db")
DATABASE_PATH = os.environ.get("KANJI_DB_PATH", default_db_path)


def ensure_database_directory():
    """Ensure the database directory exists and is writable"""
    global DATABASE_PATH

    db_dir = os.path.dirname(DATABASE_PATH)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
        except Exception as e:
            print(f"Warning: Could not create database directory {db_dir}: {e}")

    # Test if we can write to the database location
    test_file = DATABASE_PATH + ".test"
    try:
        with open(test_file, "w") as f:
            f.write("test")
        os.remove(test_file)
        return True
    except Exception as e:
        print(f"Warning: Cannot write to database location {DATABASE_PATH}: {e}")
        # On Windows /tmp might not exist, and we want to fail if we can't write
        # to the real DB
        # DATABASE_PATH = "/tmp/kanji_database.db"
        # print(f"Using fallback database path: {DATABASE_PATH}")
        return True  # Try anyway? Or False?


def get_db():
    """Get database connection"""
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_database():
    """Initialize database with kanji data"""
    # Ensure database directory exists and is writable
    ensure_database_directory()

    with get_db() as db:
        # Create kanji table
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS kanji (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kanji TEXT NOT NULL UNIQUE,
                onyomi TEXT, -- JSON array of onyomi readings
                kunyomi TEXT, -- JSON array of kunyomi readings
                meanings TEXT NOT NULL, -- JSON array of meanings
                jlpt TEXT, -- N5, N4, N3, N2, N1
                grade TEXT, -- 1-6, S (secondary), U (university)
                strokes INTEGER,
                categories TEXT, -- JSON array of categories
                frequency INTEGER, -- Frequency ranking (1 = most common)
                radical TEXT,
                is_jouyou BOOLEAN DEFAULT 0,
                is_jinmeiyou BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """
        )

        # Create favorites table
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS favorites (
                kanji TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Create vocabulary favorites table
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS vocab_favorites (
                vocab_id INTEGER PRIMARY KEY,
                expression TEXT,
                reading TEXT,
                translation TEXT,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(vocab_id) REFERENCES vocabulary(id)
            )
            """
        )

        # Create examples table
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS examples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                japanese TEXT,
                english TEXT,
                words TEXT -- JSON array of words for indexing
            )
            """
        )

        # Create jmdict table (official dictionary)
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS jmdict (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expression TEXT,
                reading TEXT,
                translation TEXT,
                tags TEXT
            )
            """
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_jmdict_expression ON jmdict(expression)"
        )
        db.execute("CREATE INDEX IF NOT EXISTS idx_jmdict_reading ON jmdict(reading)")
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_jmdict_translation ON jmdict(translation)"
        )

        # jlpt_vocabulary table (populated by scripts/seed_jlpt_vocab.py from open-anki-jlpt-decks)
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS jlpt_vocabulary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expression TEXT NOT NULL,
                reading TEXT NOT NULL,
                meaning TEXT NOT NULL,
                jlpt_level TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(expression, jlpt_level)
            )
            """
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_jlpt_vocab_level ON jlpt_vocabulary(jlpt_level)"
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_jlpt_vocab_expr ON jlpt_vocabulary(expression)"
        )

        jlpt_vocab_count = db.execute(
            "SELECT COUNT(*) as c FROM jlpt_vocabulary"
        ).fetchone()["c"]
        if jlpt_vocab_count == 0:
            seed_script = os.path.join(
                os.path.dirname(__file__), "..", "scripts", "seed_jlpt_vocab.py"
            )
            if os.path.exists(seed_script):
                try:
                    result = subprocess.run(
                        [sys.executable, seed_script],
                        env={**os.environ, "KANJI_DB_PATH": DATABASE_PATH},
                        capture_output=True,
                        text=True,
                        timeout=90,
                        cwd=os.path.dirname(os.path.dirname(seed_script)),
                    )
                    if result.returncode == 0:
                        print("JLPT vocabulary seeded from web")
                    else:
                        print(f"JLPT vocab seed failed: {result.stderr}")
                except Exception as e:
                    print(f"JLPT vocab seed error: {e}")

        # Create indexes for performance
        db.execute("CREATE INDEX IF NOT EXISTS idx_kanji_jlpt ON kanji(jlpt)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_kanji_grade ON kanji(grade)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_kanji_strokes ON kanji(strokes)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_kanji_frequency ON kanji(frequency)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_kanji_jouyou ON kanji(is_jouyou)")
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_kanji_jinmeiyou ON kanji(is_jinmeiyou)"
        )

        # Check if data already exists
        count = db.execute("SELECT COUNT(*) as count FROM kanji").fetchone()["count"]
        if count == 0:
            populate_kanji_database(db)

        # Check if examples exist or if we have the sample set and need to upgrade
        example_count = db.execute("SELECT COUNT(*) as count FROM examples").fetchone()[
            "count"
        ]
        # Re-import if empty or less than 1000 (likely sample data)
        if example_count < 1000:
            if example_count > 0:
                print("Detected sample data. Clearing and re-importing full dataset...")
                db.execute("DELETE FROM examples")
                db.execute("DELETE FROM sqlite_sequence WHERE name='examples'")
            import_examples(db)

        db.commit()


def import_examples(db):
    """Import examples from JSON file"""
    json_path = os.path.join(os.path.dirname(__file__), "data", "examples.json")
    if not os.path.exists(json_path):
        print(f"Warning: Examples file not found at {json_path}")
        return

    try:
        print("Importing examples...")
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        # Expected format: list of objects or list of [id, jpn, eng, words]
        # based on source
        # The mwhirls/tatoeba-json format is typically:
        # [ { "id": 1, "text": "...", "eng": "...", "words": [...] }, ... ]
        # Let's handle list of lists or list of dicts

        # Use bulk insert for speed
        rows_to_insert = []
        for item in data:
            # Handle different potential JSON structures from tatoeba-json
            japanese = item.get("text", "") or item.get("japanese", "")
            english = item.get("eng", "") or item.get("english", "")
            words = item.get("words", [])

            if japanese and english:
                rows_to_insert.append(
                    (japanese, english, json.dumps(words, ensure_ascii=False))
                )

        db.executemany(
            "INSERT INTO examples (japanese, english, words) VALUES (?, ?, ?)",
            rows_to_insert,
        )
        print(f"Imported {len(rows_to_insert)} examples")

    except Exception as e:
        print(f"Error importing examples: {e}")


def populate_kanji_database(db):
    """Note: Database is now populated via seed_kanji.py"""


def get_complete_kanji_data():
    """Deprecated: Data is now loaded from external JSON via seed_kanji.py"""
    return []


def parse_json(field_val):
    """Helper to parse JSON fields safely"""
    if not field_val:
        return []
    try:
        if isinstance(field_val, str):
            return json.loads(field_val)
        return field_val
    except (json.JSONDecodeError, TypeError):
        # Fallback for old comma-separated format if any remains
        return [s.strip() for s in str(field_val).split(",") if s.strip()]


@app.route("/api/kanji/all", methods=["GET"])
def get_all_kanji():
    """Get all kanji data"""
    try:
        with get_db() as db:
            rows = db.execute(
                """
                SELECT kanji, onyomi, kunyomi, meanings, jlpt, grade, strokes,
                       categories, frequency, radical, is_jouyou, is_jinmeiyou
                FROM kanji
                ORDER BY frequency ASC, strokes ASC
            """
            ).fetchall()

            kanji_list = []
            for row in rows:
                kanji_list.append(
                    {
                        "kanji": row["kanji"],
                        "onyomi": parse_json(row["onyomi"]),
                        "kunyomi": parse_json(row["kunyomi"]),
                        "meanings": parse_json(row["meanings"]),
                        "jlpt": row["jlpt"],
                        "grade": row["grade"],
                        "strokes": row["strokes"],
                        "categories": parse_json(row["categories"]),
                        "frequency": row["frequency"],
                        "radical": row["radical"],
                        "is_jouyou": bool(row["is_jouyou"]),
                        "is_jinmeiyou": bool(row["is_jinmeiyou"]),
                    }
                )

            return jsonify(
                {"success": True, "kanji": kanji_list, "count": len(kanji_list)}
            )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/kanji/search", methods=["GET"])
def search_kanji():
    """Search kanji by various criteria"""
    query = request.args.get("q", "")
    jlpt = request.args.get("jlpt")
    grade = request.args.get("grade")
    category = request.args.get("category")
    min_strokes = request.args.get("min_strokes")
    max_strokes = request.args.get("max_strokes")
    limit = int(request.args.get("limit", 50))

    try:
        with get_db() as db:
            where_clauses = []
            params = []

            if query:
                where_clauses.append("(kanji LIKE ? OR meanings LIKE ?)")
                params.extend([f"%{query}%", f"%{query}%"])

            if jlpt:
                where_clauses.append("jlpt = ?")
                params.append(jlpt)

            if grade:
                where_clauses.append("grade = ?")
                params.append(grade)

            if category:
                where_clauses.append("categories LIKE ?")
                params.append(f"%{category}%")

            if min_strokes:
                where_clauses.append("strokes >= ?")
                params.append(int(min_strokes))

            if max_strokes:
                where_clauses.append("strokes <= ?")
                params.append(int(max_strokes))

            where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

            rows = db.execute(
                f"""
                SELECT kanji, onyomi, kunyomi, meanings, jlpt, grade, strokes,
                       categories, frequency, radical, is_jouyou, is_jinmeiyou
                FROM kanji
                WHERE {where_sql}
                ORDER BY frequency ASC, strokes ASC
                LIMIT ?
            """,
                params + [limit],
            ).fetchall()

            kanji_list = []
            for row in rows:
                kanji_list.append(
                    {
                        "kanji": row["kanji"],
                        "onyomi": parse_json(row["onyomi"]),
                        "kunyomi": parse_json(row["kunyomi"]),
                        "meanings": parse_json(row["meanings"]),
                        "jlpt": row["jlpt"],
                        "grade": row["grade"],
                        "strokes": row["strokes"],
                        "categories": parse_json(row["categories"]),
                        "frequency": row["frequency"],
                        "radical": row["radical"],
                        "is_jouyou": bool(row["is_jouyou"]),
                        "is_jinmeiyou": bool(row["is_jinmeiyou"]),
                    }
                )

            return jsonify(
                {
                    "success": True,
                    "kanji": kanji_list,
                    "count": len(kanji_list),
                    "query": {
                        "q": query,
                        "jlpt": jlpt,
                        "grade": grade,
                        "category": category,
                        "min_strokes": min_strokes,
                        "max_strokes": max_strokes,
                    },
                }
            )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/vocabulary/<kanji_char>", methods=["GET"])
def get_vocabulary(kanji_char):
    """Get vocabulary words containing a specific kanji"""
    limit = int(request.args.get("limit", 50))
    tag_filter = request.args.get("tag")

    try:
        with get_db() as db:
            query = """
                SELECT expression, reading, translation, tags
                FROM vocabulary
                WHERE expression LIKE ?
            """
            params = [f"%{kanji_char}%"]

            if tag_filter:
                query += " AND tags LIKE ?"
                params.append(f"%{tag_filter}%")

            query += " ORDER BY length(expression) ASC, expression ASC LIMIT ?"
            params.append(limit)

            rows = db.execute(query, params).fetchall()

            vocab_list = []
            for row in rows:
                vocab_list.append(
                    {
                        "expression": row["expression"],
                        "reading": row["reading"],
                        "translation": row["translation"],
                        "tags": row["tags"],
                    }
                )

            return jsonify(
                {"success": True, "count": len(vocab_list), "vocabulary": vocab_list}
            )
    except Exception as e:
        print(f"Error fetching vocabulary: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/dictionary/search", methods=["GET"])
def search_dictionary():
    """Search the full dictionary with pagination and filtering"""
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 50))
    search = request.args.get("search", "")
    tag_filter = request.args.get("tag", "")
    source_filter = request.args.get("source", "all")  # 'all', 'mine', 'official'
    offset = (page - 1) * limit

    try:
        with get_db() as db:
            results = []
            total_count = 0

            # --- Source Filtering Logic ---

            # 1. 'mine' Only (Personal Vocabulary)
            if source_filter == "mine":
                vocab_query = (
                    "SELECT id, expression, reading, translation, tags FROM vocabulary "
                    "WHERE 1=1"
                )
                vocab_params = []

                if search:
                    vocab_query += (
                        " AND (expression LIKE ? OR reading LIKE ? "
                        "OR translation LIKE ?)"
                    )
                    search_param = f"%{search}%"
                    vocab_params.extend([search_param, search_param, search_param])

                if tag_filter:
                    vocab_query += " AND tags LIKE ?"
                    vocab_params.append(f"%{tag_filter}%")

                # Count
                count_query = f"SELECT COUNT(*) FROM ({vocab_query})"
                total_count = db.execute(count_query, vocab_params).fetchone()[0]

                # Fetch
                vocab_query += (
                    " ORDER BY length(expression) ASC, expression ASC LIMIT ? OFFSET ?"
                )
                vocab_params.extend([limit, offset])

                rows = db.execute(vocab_query, vocab_params).fetchall()
                for row in rows:
                    is_fav = (
                        db.execute(
                            "SELECT 1 FROM vocab_favorites WHERE vocab_id = ?",
                            (row["id"],),
                        ).fetchone()
                        is not None
                    )
                    results.append(
                        {
                            "id": row["id"],
                            "expression": row["expression"],
                            "reading": row["reading"],
                            "translation": row["translation"],
                            "tags": row["tags"],
                            "is_favorite": is_fav,
                            "source": "my_vocab",
                        }
                    )

            # 2. 'official' Only (JMdict)
            elif source_filter == "official":
                jmdict_query = (
                    "SELECT id, expression, reading, translation, tags FROM jmdict "
                    "WHERE 1=1"
                )
                jmdict_params = []

                if search:
                    jmdict_query += (
                        " AND (expression LIKE ? OR reading LIKE ? "
                        "OR translation LIKE ?)"
                    )
                    search_param = f"%{search}%"
                    jmdict_params.extend([search_param, search_param, search_param])

                # Count
                count_query = f"SELECT COUNT(*) FROM ({jmdict_query})"
                total_count = db.execute(count_query, jmdict_params).fetchone()[0]

                # Fetch
                jmdict_query += (
                    " ORDER BY length(expression) ASC, expression ASC LIMIT ? OFFSET ?"
                )
                jmdict_params.extend([limit, offset])

                rows = db.execute(jmdict_query, jmdict_params).fetchall()
                for row in rows:
                    results.append(
                        {
                            "id": row["id"],
                            "expression": row["expression"],
                            "reading": row["reading"],
                            "translation": row["translation"],
                            "tags": row["tags"],
                            "is_favorite": False,
                            "source": "jmdict",
                        }
                    )

            # 3. 'all' (Combined)
            else:
                full_query = """
                    SELECT id, expression, reading, translation, tags, 'my_vocab' as source
                    FROM vocabulary WHERE 1=1
                """
                full_params = []

                if search:
                    full_query += (
                        " AND (expression LIKE ? OR reading LIKE ? "
                        "OR translation LIKE ?)"
                    )
                    search_param = f"%{search}%"
                    full_params.extend([search_param, search_param, search_param])
                if tag_filter:
                    full_query += " AND tags LIKE ?"
                    full_params.append(f"%{tag_filter}%")

                full_query += """
                    UNION ALL
                    SELECT id, expression, reading, translation, tags, 'jmdict' as source
                    " FROM jmdict WHERE 1=1"
                    "\n                """

                if search:
                    full_query += (
                        " AND (expression LIKE ? OR reading LIKE ? "
                        "OR translation LIKE ?)"
                    )
                    full_params.extend([search_param, search_param, search_param])

                if tag_filter:
                    full_query += " AND tags LIKE ?"
                    full_params.append(f"%{tag_filter}%")

                # Count
                count_sql = f"SELECT COUNT(*) FROM ({full_query})"
                total_count = db.execute(count_sql, full_params).fetchone()[0]

                # Fetch
                full_query += (
                    " ORDER BY CASE WHEN source='my_vocab' THEN 0 ELSE 1 END, "
                    "length(expression) ASC, expression ASC LIMIT ? OFFSET ?"
                )
                full_params.extend([limit, offset])

                rows = db.execute(full_query, full_params).fetchall()

                for row in rows:
                    is_fav = False
                    if row["source"] == "my_vocab":
                        is_fav = (
                            db.execute(
                                "SELECT 1 FROM vocab_favorites WHERE vocab_id = ?",
                                (row["id"],),
                            ).fetchone()
                            is not None
                        )

                    results.append(
                        {
                            "id": row["id"],
                            "expression": row["expression"],
                            "reading": row["reading"],
                            "translation": row["translation"],
                            "tags": row["tags"],
                            "source": row["source"],
                            "is_favorite": is_fav,
                        }
                    )

            return jsonify(
                {
                    "success": True,
                    "results": results,
                    "total": total_count,
                    "page": page,
                    "limit": limit,
                    "pages": (total_count + limit - 1) // limit if limit > 0 else 0,
                }
            )

    except Exception as e:
        print(f"Error searching dictionary: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/examples/search", methods=["GET"])
def search_examples():
    """Search for example sentences containing a word"""
    word = request.args.get("word", "")
    limit = int(request.args.get("limit", 10))

    if not word:
        return jsonify({"success": False, "error": "No word provided"}), 400

    try:
        with get_db() as db:
            # Simple LIKE query for now.
            # We check both the full japanese text and the 'words' array column
            rows = db.execute(
                """
                SELECT japanese, english
                FROM examples
                WHERE japanese LIKE ? OR words LIKE ?
                LIMIT ?
                """,
                (f"%{word}%", f'%"{word}"%', limit),
            ).fetchall()

            results = [
                {"japanese": row["japanese"], "english": row["english"]} for row in rows
            ]

            return jsonify(
                {"success": True, "count": len(results), "examples": results}
            )

    except Exception as e:
        print(f"Error searching examples: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/dictionary/favorites", methods=["GET", "POST", "DELETE"])
def handle_vocab_favorites():
    """Manage personal vocabulary list"""
    try:
        with get_db() as db:
            if request.method == "POST":
                data = request.json
                vocab_id = data.get("vocab_id")

                # We need to copy the vocab data to the favorites table so it's
                # self-contained or just link it. Linking is better as we have
                # foreign key.
                # However, for the user list, we might want to cache the text to avoid joins if performance issues arise.
                # But for now, let's just insert the ID and rely on the link.
                # Wait, my schema definition:
                # CREATE TABLE IF NOT EXISTS vocab_favorites (
                #     vocab_id INTEGER PRIMARY KEY,
                #     expression TEXT, ...
                # )
                # It duplicates data. This is good for "snapshotting" or if we want to edit meanings later.

                # Fetch original data first
                vocab = db.execute(
                    "SELECT * FROM vocabulary WHERE id = ?", (vocab_id,)
                ).fetchone()
                if not vocab:
                    return jsonify(
                        {"success": False, "error": "Vocabulary not found"}
                    ), 404

                db.execute(
                    """
                    INSERT OR IGNORE INTO vocab_favorites
                    (vocab_id, expression, reading, translation, tags)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        vocab["id"],
                        vocab["expression"],
                        vocab["reading"],
                        vocab["translation"],
                        vocab["tags"],
                    ),
                )
                db.commit()
                return jsonify({"success": True})

            if request.method == "DELETE":
                vocab_id = request.args.get("id")
                db.execute(
                    "DELETE FROM vocab_favorites WHERE vocab_id = ?", (vocab_id,)
                )
                db.commit()
                return jsonify({"success": True})

            if request.method == "GET":
                # List favorites
                rows = db.execute(
                    "SELECT * FROM vocab_favorites ORDER BY created_at DESC"
                ).fetchall()
                results = [dict(row) for row in rows]
                return jsonify({"success": True, "favorites": results})

    except Exception as e:
        print(f"Error handling favorites: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/kanji/stats", methods=["GET"])
def get_kanji_stats():
    """Get kanji database statistics"""
    try:
        with get_db() as db:
            stats = db.execute(
                """
                SELECT
                    COUNT(*) as total_kanji,
                    COUNT(CASE WHEN is_jouyou THEN 1 END) as jouyou_kanji,
                    COUNT(CASE WHEN is_jinmeiyou THEN 1 END) as jinmeiyou_kanji,
                    AVG(strokes) as avg_strokes,
                    MAX(strokes) as max_strokes,
                    MIN(strokes) as min_strokes
                FROM kanji
            """
            ).fetchone()

            jlpt_stats = db.execute(
                """
                SELECT jlpt, COUNT(*) as count
                FROM kanji
                WHERE jlpt IS NOT NULL
                GROUP BY jlpt
                ORDER BY CAST(jlpt AS INTEGER)
            """
            ).fetchall()

            grade_stats = db.execute(
                """
                SELECT grade, COUNT(*) as count
                FROM kanji
                GROUP BY grade
                ORDER BY CASE WHEN grade IS NULL THEN 999 ELSE grade END
            """
            ).fetchall()

            return jsonify(
                {
                    "success": True,
                    "stats": {
                        "total_kanji": stats["total_kanji"],
                        "jouyou_kanji": stats["jouyou_kanji"],
                        "jinmeiyou_kanji": stats["jinmeiyou_kanji"],
                        "avg_strokes": round(stats["avg_strokes"] or 0, 1),
                        "max_strokes": stats["max_strokes"],
                        "min_strokes": stats["min_strokes"],
                    },
                    "jlpt_breakdown": {
                        str(row["jlpt"]): row["count"] for row in jlpt_stats
                    },
                    "grade_breakdown": {
                        str(row["grade"]) if row["grade"] is not None else "null": row[
                            "count"
                        ]
                        for row in grade_stats
                    },
                }
            )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/vocabulary", methods=["GET"])
def get_vocabulary_flashcards():
    """Generate vocabulary flashcards from jlpt_vocabulary (web-sourced) or kanji database fallback"""
    jlpt_level = request.args.get("jlpt")
    limit = int(request.args.get("limit", 100))
    offset = int(request.args.get("offset", 0))

    try:
        with get_db() as db:
            vocabulary = []

            # Prefer jlpt_vocabulary table (populated from open-anki-jlpt-decks)
            jlpt_count = db.execute(
                "SELECT COUNT(*) as c FROM jlpt_vocabulary"
            ).fetchone()["c"]
            if jlpt_count > 0:
                params = []
                where = "1=1"
                if jlpt_level and jlpt_level != "all":
                    where = "jlpt_level = ?"
                    params = [jlpt_level]
                params.extend([limit, offset])
                rows = db.execute(
                    f"""
                    SELECT expression, reading, meaning, jlpt_level
                    FROM jlpt_vocabulary WHERE {where}
                    ORDER BY RANDOM()
                    LIMIT ? OFFSET ?
                    """,
                    params,
                ).fetchall()
                for row in rows:
                    vocabulary.append(
                        {
                            "japanese": row["expression"],
                            "reading": row["reading"],
                            "meaning": row["meaning"],
                            "jlpt_level": row["jlpt_level"],
                            "difficulty": "intermediate",
                            "part_of_speech": "noun",
                            "kanji_breakdown": [],
                            "examples": [],
                            "source": "jlpt_vocabulary",
                        }
                    )

            # Fallback to kanji-based generation if jlpt_vocabulary empty or insufficient
            if len(vocabulary) < limit:
                where_clauses = ["is_jouyou = 1"]
                params = []
                if jlpt_level and jlpt_level != "all":
                    where_clauses.append("jlpt = ?")
                    params.append(jlpt_level)
                where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
                params.extend([(limit - len(vocabulary)) * 2, offset])

                kanji_rows = db.execute(
                    f"""
                    SELECT kanji, onyomi, kunyomi, meanings, jlpt, grade, strokes
                    FROM kanji
                    WHERE {where_sql}
                    ORDER BY frequency ASC, strokes ASC
                    LIMIT ? OFFSET ?
                    """,
                    params,
                ).fetchall()

                for row in kanji_rows:
                    kanji = row["kanji"]
                    meanings_str = row["meanings"] or ""
                    onyomi_str = row["onyomi"] or ""
                    kunyomi_str = row["kunyomi"] or ""

                    import re

                    meanings_str = re.sub(r'[\[\]"\']', "", meanings_str)
                    onyomi_str = re.sub(r'[\[\]"\']', "", onyomi_str)
                    kunyomi_str = re.sub(r'[\[\]"\']', "", kunyomi_str)

                    import codecs

                    try:
                        meanings_str = codecs.decode(meanings_str, "unicode_escape")
                    except Exception:
                        pass
                    try:
                        onyomi_str = codecs.decode(onyomi_str, "unicode_escape")
                    except Exception:
                        pass
                    try:
                        kunyomi_str = codecs.decode(kunyomi_str, "unicode_escape")
                    except Exception:
                        pass

                    meanings = meanings_str.split(", ") if meanings_str else []
                    onyomi = onyomi_str.split(", ") if onyomi_str else []
                    kunyomi = kunyomi_str.split(", ") if kunyomi_str else []

                    if meanings and meanings[0]:
                        vocab_card = {
                            "japanese": kanji,
                            "reading": onyomi[0]
                            if onyomi
                            else (kunyomi[0] if kunyomi else ""),
                            "meaning": meanings[0],
                            "jlpt_level": row["jlpt"] or "N5",
                            "difficulty": "intermediate",
                            "part_of_speech": "noun",
                            "kanji_breakdown": [kanji],
                            "examples": [
                                f"{kanji} - {meanings[0]}",
                                f"これは{kanji}です - This is {meanings[0]}",
                            ],
                            "source": "kanji_compound",
                        }
                        vocabulary.append(vocab_card)
                        if len(vocabulary) < limit:
                            compounds = generate_compound_vocabulary(
                                kanji, meanings[0], row["jlpt"] or "N5"
                            )
                            vocabulary.extend(
                                compounds[: min(5, limit - len(vocabulary))]
                            )

            # If we don't have enough vocabulary from kanji, add some standard JLPT words
            if len(vocabulary) < limit:
                standard_vocab = get_standard_jlpt_vocabulary(
                    jlpt_level, limit - len(vocabulary)
                )
                vocabulary.extend(standard_vocab)

            # Shuffle and limit results
            import random

            random.shuffle(vocabulary)
            vocabulary = vocabulary[:limit]

            return jsonify(
                {
                    "success": True,
                    "vocabulary": vocabulary,
                    "count": len(vocabulary),
                    "total_available": len(vocabulary),  # Estimate
                }
            )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def generate_compound_vocabulary(base_kanji, base_meaning, jlpt_level):
    """Generate compound vocabulary using base kanji"""
    compounds = []

    # Use more realistic Japanese vocabulary patterns based on common kanji combinations
    # These are actual Japanese words that use common kanji
    realistic_compounds = [
        # N5 level compounds
        ("学校", "gakkou", "school", "noun", ["学", "校"]),
        ("学生", "gakusei", "student", "noun", ["学", "生"]),
        ("先生", "sensei", "teacher", "noun", ["先", "生"]),
        ("時間", "jikan", "time", "noun", ["時", "間"]),
        ("食べ物", "tabemono", "food", "noun", ["食", "物"]),
        ("飲み物", "nomimono", "drink", "noun", ["飲", "物"]),
        ("家族", "kazoku", "family", "noun", ["家", "族"]),
        ("友達", "tomodachi", "friend", "noun", ["友", "達"]),
        # N4 level compounds
        ("開発", "kaihatsu", "development", "noun", ["開", "発"]),
        ("技術", "gijutsu", "technology", "noun", ["技", "術"]),
        ("経済", "keizai", "economy", "noun", ["経", "済"]),
        ("教育", "kyouiku", "education", "noun", ["教", "育"]),
        ("文化", "bunka", "culture", "noun", ["文", "化"]),
        # N3 level compounds
        ("影響", "eikyou", "influence", "noun", ["影", "響"]),
        ("解決", "kaiketsu", "solution", "noun", ["解", "決"]),
        ("努力", "doryoku", "effort", "noun", ["努", "力"]),
        ("成功", "seikou", "success", "noun", ["成", "功"]),
    ]

    # Filter compounds by JLPT level
    level_compounds = []
    if jlpt_level == "N5":
        level_compounds = realistic_compounds[:8]  # First 8 are N5
    elif jlpt_level == "N4":
        level_compounds = realistic_compounds[8:13]  # Next 5 are N4
    elif jlpt_level == "N3":
        level_compounds = realistic_compounds[13:]  # Last 4 are N3
    else:
        level_compounds = realistic_compounds  # All levels

    for japanese, reading, meaning, pos, kanji_breakdown in level_compounds[
        :5
    ]:  # Limit to 5 per kanji
        compounds.append(
            {
                "japanese": japanese,
                "reading": reading,
                "meaning": meaning,
                "jlpt_level": jlpt_level,
                "difficulty": "intermediate",
                "part_of_speech": pos,
                "kanji_breakdown": kanji_breakdown,
                "examples": [
                    f"{japanese}があります - There is {meaning}",
                    f"{japanese}を学びます - I study {meaning}",
                ],
                "source": "real_compound",
            }
        )

    return compounds


def get_standard_jlpt_vocabulary(jlpt_level, count):
    """Get standard JLPT vocabulary for when kanji compounds aren't enough"""
    standard_vocab = [
        # N5 vocabulary
        {
            "japanese": "こんにちは",
            "reading": "konnichiwa",
            "meaning": "hello",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "greeting",
            "examples": ["こんにちは、お元気ですか？"],
        },
        {
            "japanese": "ありがとう",
            "reading": "arigatou",
            "meaning": "thank you",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "expression",
            "examples": ["ありがとうございます"],
        },
        {
            "japanese": "すみません",
            "reading": "sumimasen",
            "meaning": "excuse me/sorry",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "expression",
            "examples": ["すみません、お手洗所はどこですか？"],
        },
        {
            "japanese": "わかりません",
            "reading": "wakarimasen",
            "meaning": "I don't understand",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "expression",
            "examples": ["すみません、わかりません"],
        },
        {
            "japanese": "学校",
            "reading": "gakkou",
            "meaning": "school",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["学校に行きます"],
        },
        {
            "japanese": "学生",
            "reading": "gakusei",
            "meaning": "student",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["私は学生です"],
        },
        {
            "japanese": "先生",
            "reading": "sensei",
            "meaning": "teacher",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["田中先生"],
        },
        {
            "japanese": "友達",
            "reading": "tomodachi",
            "meaning": "friend",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["私の友達"],
        },
        {
            "japanese": "家族",
            "reading": "kazoku",
            "meaning": "family",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["私の家族"],
        },
        {
            "japanese": "時間",
            "reading": "jikan",
            "meaning": "time",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["時間がありません"],
        },
        {
            "japanese": "食べ物",
            "reading": "tabemono",
            "meaning": "food",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["美味しい食べ物"],
        },
        {
            "japanese": "飲み物",
            "reading": "nomimono",
            "meaning": "drink",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["冷たい飲み物"],
        },
        {
            "japanese": "本",
            "reading": "hon",
            "meaning": "book",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["本を読みます"],
        },
        {
            "japanese": "映画",
            "reading": "eiga",
            "meaning": "movie",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["映画を見ます"],
        },
        {
            "japanese": "音楽",
            "reading": "ongaku",
            "meaning": "music",
            "jlpt_level": "N5",
            "difficulty": "beginner",
            "part_of_speech": "noun",
            "examples": ["音楽を聞きます"],
        },
        # N4 vocabulary
        {
            "japanese": "開発",
            "reading": "kaihatsu",
            "meaning": "development",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["ソフトウェア開発"],
        },
        {
            "japanese": "経験",
            "reading": "keiken",
            "meaning": "experience",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["仕事の経験"],
        },
        {
            "japanese": "技術",
            "reading": "gijutsu",
            "meaning": "technology",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["最新技術"],
        },
        {
            "japanese": "経済",
            "reading": "keizai",
            "meaning": "economy",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["日本経済"],
        },
        {
            "japanese": "政治",
            "reading": "seiji",
            "meaning": "politics",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["政治問題"],
        },
        {
            "japanese": "社会",
            "reading": "shakai",
            "meaning": "society",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["現代社会"],
        },
        {
            "japanese": "文化",
            "reading": "bunka",
            "meaning": "culture",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["日本文化"],
        },
        {
            "japanese": "教育",
            "reading": "kyouiku",
            "meaning": "education",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["教育制度"],
        },
        {
            "japanese": "環境",
            "reading": "kankyou",
            "meaning": "environment",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["自然環境"],
        },
        {
            "japanese": "健康",
            "reading": "kenkou",
            "meaning": "health",
            "jlpt_level": "N4",
            "difficulty": "intermediate",
            "part_of_speech": "noun",
            "examples": ["健康管理"],
        },
        # N3 vocabulary
        {
            "japanese": "影響",
            "reading": "eikyou",
            "meaning": "influence/effect",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["大きな影響"],
        },
        {
            "japanese": "原因",
            "reading": "genin",
            "meaning": "cause",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["事故の原因"],
        },
        {
            "japanese": "結果",
            "reading": "kekka",
            "meaning": "result",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["テストの結果"],
        },
        {
            "japanese": "変化",
            "reading": "henka",
            "meaning": "change",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["大きな変化"],
        },
        {
            "japanese": "解決",
            "reading": "kaiketsu",
            "meaning": "solution",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["問題解決"],
        },
        {
            "japanese": "努力",
            "reading": "doryoku",
            "meaning": "effort",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["一生懸命努力"],
        },
        {
            "japanese": "成功",
            "reading": "seikou",
            "meaning": "success",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["大成功"],
        },
        {
            "japanese": "失敗",
            "reading": "shippai",
            "meaning": "failure",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["大失敗"],
        },
        {
            "japanese": "挑戦",
            "reading": "chousen",
            "meaning": "challenge",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["新しい挑戦"],
        },
        {
            "japanese": "創造",
            "reading": "souzou",
            "meaning": "creation/creativity",
            "jlpt_level": "N3",
            "difficulty": "advanced",
            "part_of_speech": "noun",
            "examples": ["創造力"],
        },
    ]

    # Filter by JLPT level if specified
    if jlpt_level and jlpt_level != "all":
        filtered_vocab = [v for v in standard_vocab if v["jlpt_level"] == jlpt_level]
    else:
        filtered_vocab = standard_vocab

    # Add kanji breakdown for standard vocabulary
    for vocab in filtered_vocab:
        vocab["kanji_breakdown"] = [vocab["japanese"]]  # Simplified
        vocab["source"] = "standard_jlpt"

    return filtered_vocab[:count]


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(
        {
            "status": "healthy",
            "service": "Kanji Database API",
            "database": "connected" if os.path.exists(DATABASE_PATH) else "not found",
        }
    )


if __name__ == "__main__":
    try:
        init_database()
        print("Kanji database initialized successfully")
    except Exception as e:
        print(f"Database initialization failed: {e}")
    port = int(os.environ.get("KANJI_API_PORT", 11003))
    host = os.environ.get("HOST", "127.0.0.1")
    # Parse boolean debug flag safely
    debug_val = os.environ.get("DEBUG_MODE", "True").lower()
    debug = debug_val in ("true", "1", "t", "yes")

    app.run(host=host, port=port, debug=debug)
