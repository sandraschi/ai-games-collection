#!/usr/bin/env python3
"""
JLPT Practice Test API Server
Database-driven question management for scalable JLPT practice
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
default_db_path = os.path.join(
    os.path.dirname(__file__), "..", "data", "jlpt_questions.db"
)
DATABASE_PATH = os.environ.get("JLPT_DB_PATH", default_db_path)
MIN_QUESTIONS = 600  # 12 tests x 5 levels x 10 questions


def get_db():
    """Get database connection"""
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_database():
    """Initialize database with schema"""
    print("Initializing JLPT database...")
    with get_db() as db:
        # Create questions table
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                question_type TEXT NOT NULL,
                question_text TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                test_set INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                difficulty_rating INTEGER DEFAULT 1,
                times_asked INTEGER DEFAULT 0,
                times_correct INTEGER DEFAULT 0
            )
        """
        )

        # Create question options table
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS question_options (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                option_letter TEXT NOT NULL,
                option_text TEXT NOT NULL,
                explanation TEXT NOT NULL,
                FOREIGN KEY (question_id) REFERENCES questions (id)
            )
        """
        )

        # Create user progress table
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS user_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                question_id INTEGER NOT NULL,
                user_answer TEXT NOT NULL,
                is_correct BOOLEAN NOT NULL,
                response_time_ms INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (question_id) REFERENCES questions (id)
            )
        """
        )

        # Create indexes for performance
        db.execute("CREATE INDEX IF NOT EXISTS idx_questions_level ON questions(level)")
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type)"
        )
        db.execute(
            "CREATE INDEX IF NOT EXISTS idx_user_progress_session ON user_progress(session_id)"
        )

        # Ensure test_set column exists (for 12 tests per level)
        try:
            db.execute("ALTER TABLE questions ADD COLUMN test_set INTEGER DEFAULT 1")
            db.commit()
        except sqlite3.OperationalError:
            pass

        question_count = db.execute(
            "SELECT COUNT(*) as count FROM questions"
        ).fetchone()["count"]
        print(f"Found {question_count} questions in database")
        if question_count < MIN_QUESTIONS:
            print("Populating/reseeding database with questions...")
            seed_script = os.path.join(
                os.path.dirname(__file__), "..", "scripts", "seed_jlpt_tests.py"
            )
            try:
                if os.path.exists(seed_script):
                    result = subprocess.run(
                        [sys.executable, seed_script],
                        env={**os.environ, "JLPT_DB_PATH": DATABASE_PATH},
                        capture_output=True,
                        text=True,
                        timeout=120,
                        cwd=os.path.dirname(os.path.dirname(seed_script)),
                    )
                    if result.returncode == 0:
                        print("Web seed completed successfully")
                    else:
                        print(f"Web seed failed: {result.stderr}")
                        db.execute("DELETE FROM question_options")
                        db.execute("DELETE FROM questions")
                        populate_questions(db)
                else:
                    db.execute("DELETE FROM question_options")
                    db.execute("DELETE FROM questions")
                    populate_questions(db)
            except Exception as e:
                print(f"Web seed error: {e}, falling back to JSON")
                db.execute("DELETE FROM question_options")
                db.execute("DELETE FROM questions")
                populate_questions(db)
            print("Database population complete")

        db.commit()


def populate_questions(db):
    """Populate database with JLPT questions from JSON data file"""
    json_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "jlpt_questions.json"
    )
    with open(json_path, encoding="utf-8") as f:
        questions_data = json.load(f)

    total = 0
    test_set = 1
    for level, types in questions_data.items():
        for question_type, questions in types.items():
            for idx, question_data in enumerate(questions):
                ts = (idx % 12) + 1
                cursor = db.execute(
                    """
                    INSERT INTO questions (level, question_type, question_text, correct_answer, test_set)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    [
                        level,
                        question_type,
                        question_data["question"],
                        question_data["correct"],
                        ts,
                    ],
                )
                question_id = cursor.lastrowid
                for option_letter, option_text in question_data["options"].items():
                    explanation = question_data["explanations"].get(option_letter, "")
                    db.execute(
                        """
                        INSERT INTO question_options (question_id, option_letter, option_text, explanation)
                        VALUES (?, ?, ?, ?)
                    """,
                        [question_id, option_letter, option_text, explanation],
                    )
                total += 1

    print(f"Populated database with {total} questions")


@app.route("/test", methods=["GET"])
def test_route():
    """Test route"""
    return jsonify({"message": "JLPT API is working!", "database_questions": 18})


@app.route("/questions", methods=["GET"])
def get_questions():
    """Get questions by level, type, and test set (1-12 per level)"""
    level = request.args.get("level", "N5")
    question_type = request.args.get("type", "mixed")
    test_set = request.args.get("test_set", type=int)
    limit = int(request.args.get("limit", 10))
    exclude_ids = request.args.get("exclude_ids", "")

    excluded_ids = [int(x) for x in exclude_ids.split(",") if x.strip()]

    try:
        with get_db() as db:
            level_filter = "q.level = ?"
            params = [level]
            filters = [level_filter]

            if test_set is not None and 1 <= test_set <= 12:
                filters.append("q.test_set = ?")
                params.append(test_set)

            if question_type != "mixed":
                filters.append("q.question_type = ?")
                params.append(question_type)

            if excluded_ids:
                placeholders = ",".join("?" * len(excluded_ids))
                filters.append(f"q.id NOT IN ({placeholders})")
                params.extend(excluded_ids)

            where_sql = " AND ".join(filters)
            params.append(limit)
            sql = f"""
                SELECT q.id, q.level, q.question_type, q.question_text, q.correct_answer
                FROM questions q
                WHERE {where_sql}
                ORDER BY RANDOM()
                LIMIT ?
            """

            rows = db.execute(sql, params).fetchall()

            questions_out = []
            for row in rows:
                opt_rows = db.execute(
                    "SELECT option_letter, option_text, explanation FROM question_options WHERE question_id = ?",
                    [row["id"]],
                ).fetchall()
                options = {r["option_letter"]: r["option_text"] for r in opt_rows}
                explanations = {r["option_letter"]: r["explanation"] for r in opt_rows}
                questions_out.append(
                    {
                        "id": row["id"],
                        "level": row["level"],
                        "type": row["question_type"],
                        "question": row["question_text"],
                        "correct": row["correct_answer"],
                        "options": options,
                        "explanations": explanations,
                    }
                )

            return jsonify(
                {
                    "success": True,
                    "questions": questions_out,
                    "count": len(questions_out),
                }
            )

    except Exception as e:
        print(f"JLPT API error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/submit-answers", methods=["POST"])
def submit_answers():
    """Submit user answers and get results"""
    data = request.get_json()
    session_id = data.get("session_id", "anonymous")
    answers = data.get("answers", [])

    results = []
    total_correct = 0

    with get_db() as db:
        for answer in answers:
            question_id = answer["question_id"]
            user_answer = answer.get("answer") or answer.get("user_answer")
            response_time = answer.get("response_time_ms", 0)

            # Get correct answer
            correct_row = db.execute(
                "SELECT correct_answer FROM questions WHERE id = ?", [question_id]
            ).fetchone()
            if correct_row:
                correct_answer = correct_row["correct_answer"]
                is_correct = user_answer == correct_answer

                if is_correct:
                    total_correct += 1

                # Record progress
                db.execute(
                    """
                    INSERT INTO user_progress (session_id, question_id, user_answer, is_correct, response_time_ms)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    [session_id, question_id, user_answer, is_correct, response_time],
                )

                # Update question statistics
                db.execute(
                    """
                    UPDATE questions
                    SET times_asked = times_asked + 1,
                        times_correct = times_correct + ?
                    WHERE id = ?
                """,
                    [1 if is_correct else 0, question_id],
                )

                results.append(
                    {
                        "question_id": question_id,
                        "user_answer": user_answer,
                        "correct_answer": correct_answer,
                        "is_correct": is_correct,
                    }
                )

        db.commit()

    return jsonify(
        {
            "success": True,
            "results": results,
            "score": f"{total_correct}/{len(answers)}",
            "percentage": round((total_correct / len(answers)) * 100, 1)
            if answers
            else 0,
        }
    )


@app.route("/progress", methods=["GET"])
def get_progress():
    """Get user progress statistics"""
    session_id = request.args.get("session_id", "anonymous")

    with get_db() as db:
        # Overall statistics
        stats_row = db.execute(
            """
            SELECT
                COUNT(*) as total_answered,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as total_correct,
                AVG(response_time_ms) as avg_response_time
            FROM user_progress
            WHERE session_id = ?
        """,
            [session_id],
        ).fetchone()

        # Statistics by level
        level_stats = db.execute(
            """
            SELECT
                q.level,
                COUNT(up.id) as questions_answered,
                SUM(CASE WHEN up.is_correct THEN 1 ELSE 0 END) as correct_answers,
                ROUND(AVG(up.response_time_ms), 0) as avg_time
            FROM user_progress up
            JOIN questions q ON up.question_id = q.id
            WHERE up.session_id = ?
            GROUP BY q.level
            ORDER BY q.level
        """,
            [session_id],
        ).fetchall()

        return jsonify(
            {
                "success": True,
                "overall": {
                    "total_answered": stats_row["total_answered"] or 0,
                    "total_correct": stats_row["total_correct"] or 0,
                    "accuracy": round(
                        (stats_row["total_correct"] or 0)
                        / max(stats_row["total_answered"] or 1, 1)
                        * 100,
                        1,
                    ),
                    "avg_response_time": round(stats_row["avg_response_time"] or 0, 0),
                },
                "by_level": [
                    {
                        "level": row["level"],
                        "answered": row["questions_answered"],
                        "correct": row["correct_answers"],
                        "accuracy": round(
                            row["correct_answers"]
                            / max(row["questions_answered"], 1)
                            * 100,
                            1,
                        ),
                        "avg_time": row["avg_time"] or 0,
                    }
                    for row in level_stats
                ],
            }
        )


@app.route("/question-stats", methods=["GET"])
def get_question_stats():
    """Get question difficulty statistics"""
    level = request.args.get("level")

    with get_db() as db:
        if level:
            rows = db.execute(
                """
                SELECT level, question_type, COUNT(*) as total_questions,
                       AVG(times_correct * 1.0 / NULLIF(times_asked, 0)) as avg_accuracy,
                       AVG(difficulty_rating) as avg_difficulty
                FROM questions
                WHERE level = ?
                GROUP BY level, question_type
            """,
                [level],
            ).fetchall()
        else:
            rows = db.execute(
                """
                SELECT level, question_type, COUNT(*) as total_questions,
                       AVG(times_correct * 1.0 / NULLIF(times_asked, 0)) as avg_accuracy,
                       AVG(difficulty_rating) as avg_difficulty
                FROM questions
                GROUP BY level, question_type
                ORDER BY level, question_type
            """
            ).fetchall()

        return jsonify(
            {
                "success": True,
                "stats": [
                    {
                        "level": row["level"],
                        "type": row["question_type"],
                        "total_questions": row["total_questions"],
                        "avg_accuracy": round(row["avg_accuracy"] or 0, 3),
                        "avg_difficulty": round(row["avg_difficulty"] or 0, 1),
                    }
                    for row in rows
                ],
            }
        )


@app.route("/add-question", methods=["POST"])
def add_question():
    """Add a new question to the database"""
    data = request.get_json()

    with get_db() as db:
        # Insert question
        cursor = db.execute(
            """
            INSERT INTO questions (level, question_type, question_text, correct_answer, difficulty_rating)
            VALUES (?, ?, ?, ?, ?)
        """,
            [
                data["level"],
                data["type"],
                data["question"],
                data["correct"],
                data.get("difficulty", 1),
            ],
        )

        question_id = cursor.lastrowid

        # Insert options
        for letter, option_data in data["options"].items():
            db.execute(
                """
                INSERT INTO question_options (question_id, option_letter, option_text, explanation)
                VALUES (?, ?, ?, ?)
            """,
                [question_id, letter, option_data["text"], option_data["explanation"]],
            )

        db.commit()

        return jsonify(
            {
                "success": True,
                "question_id": question_id,
                "message": "Question added successfully",
            }
        )


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(
        {
            "status": "healthy",
            "service": "JLPT API Server",
            "database": "connected" if os.path.exists(DATABASE_PATH) else "not found",
        }
    )


if __name__ == "__main__":
    print("Starting JLPT API server...")
    init_database()
    print("JLPT API database initialized, starting Flask app...")
    port = int(os.environ.get("JLPT_API_PORT", 11001))
    host = os.environ.get("HOST", "127.0.0.1")
    debug_val = os.environ.get("DEBUG_MODE", "True").lower()
    debug = debug_val in ("true", "1", "t", "yes")

    app.run(host=host, port=port, debug=debug)
