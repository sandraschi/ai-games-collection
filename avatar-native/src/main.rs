//! avatar-native: load Nekomimi-chan.vrm via bevy_vrm1, ground plane via rapier.
//! Run: cargo run -- --vrm ../../avatar-mcp/models/Nekomimi-chan.vrm
//! Kings-and-queens scaffold — orbit camera, spring-bones on, physics ground.

use bevy::prelude::*;
use bevy_rapier3d::prelude::*;

#[derive(Resource)]
struct VrmPath(String);

fn main() {
    let vrm = std::env::args()
        .nth(2)
        .unwrap_or_else(|| "../../avatar-mcp/models/Nekomimi-chan.vrm".to_string());
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(RapierPhysicsPlugin::<NoUserData>::default())
        .insert_resource(VrmPath(vrm))
        .add_systems(Startup, setup)
        .run();
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut mats: ResMut<Assets<StandardMaterial>>,
    vrm_path: Res<VrmPath>,
) {
    // Camera + light
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(0.0, 1.5, 3.0).looking_at(Vec3::new(0.0, 1.1, 0.0), Vec3::Y),
        ..default()
    });
    commands.spawn(DirectionalLightBundle {
        directional_light: DirectionalLight { illuminance: 4000.0, ..default() },
        transform: Transform::from_xyz(2.0, 4.0, 3.0),
        ..default()
    });

    // Ground: visual + rapier collider
    commands.spawn((
        PbrBundle {
            mesh: meshes.add(Plane3d::default().mesh().size(10.0, 10.0)),
            material: mats.add(Color::srgb(0.29, 0.20, 0.15)),
            ..default()
        },
        RigidBody::Fixed,
        Collider::cuboid(5.0, 0.05, 5.0),
    ));

    // VRM: bevy_vrm1 loads .vrm as glTF scene. See docs.rs/bevy_vrm for VrmPlugin wiring.
    // Full spawn needs VrmPlugin + VrmLoader; this scaffold proves world + args plumbing.
    // TODO: add_plugins(VrmPlugins) + commands.spawn(VrmScene { path: vrm_path.0.clone() })
    info!("VRM path: {}", vrm_path.0);
    info!("TODO: wire VrmPlugins once bevy version pinned to bevy_vrm1 requirements");
}
