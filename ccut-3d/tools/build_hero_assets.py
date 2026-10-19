import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "models"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, color, metallic=0.0, roughness=0.55, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic IOR" if "Metallic IOR" in bsdf.inputs else "Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        emission_input = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[emission_input].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def box(name, size, location, mat, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Soft stone edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    obj.parent = parent
    return obj


def cylinder_between(name, start, end, radius, mat, parent=None, vertices=10):
    a, b = Vector(start), Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def curve_stroke(name, points, radius, mat, parent=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 2
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, point in zip(spline.bezier_points, points):
        bp.co = point
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    obj.parent = parent
    return obj


def export_glb(filename):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / filename),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )


def add_facade_windows(parent, center_x, center_y, width, floors, columns, wall_height, glass, trim, warm):
    usable = width - 10
    step_x = usable / columns
    ground = 4.2
    step_z = (wall_height - ground - 2.0) / floors
    for floor in range(floors):
        z = ground + 1.0 + floor * step_z
        for col in range(columns):
            x = center_x - usable / 2 + step_x * (col + 0.5)
            is_warm = (floor * 5 + col * 3) % 7 in (0, 2)
            window_mat = warm if is_warm else glass
            box(f"Window_{floor:02d}_{col:02d}", (step_x * 0.54, 0.25, step_z * 0.62), (x, center_y, z), window_mat, parent, .05)
            box(f"Sill_{floor:02d}_{col:02d}", (step_x * 0.66, 0.34, .18), (x, center_y - .03, z - step_z * .36), trim, parent, .03)


def arched_panel(name, width, height, depth, location, mat, parent):
    radius = width / 2
    spring = height / 2 - radius
    outline = [(-width / 2, -height / 2), (-width / 2, spring)]
    for index in range(9):
        angle = math.pi - math.pi * index / 8
        outline.append((math.cos(angle) * radius, spring + math.sin(angle) * radius))
    outline.extend([(width / 2, -height / 2)])
    count = len(outline)
    verts = [(x, -depth / 2, z) for x, z in outline] + [(x, depth / 2, z) for x, z in outline]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    faces.extend((i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count))
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(mat)
    obj.parent = parent
    bevel = obj.modifiers.new("Masonry edge", "BEVEL")
    bevel.width = .045
    bevel.segments = 2
    return obj


def pediment(name, parent, width, front_y, base_z, height, wall, trim):
    verts = [(-width / 2, front_y, base_z), (width / 2, front_y, base_z), (0, front_y, base_z + height)]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], [(0, 1, 2)])
    face = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(face)
    face.data.materials.append(wall)
    face.parent = parent
    for index, (start, end) in enumerate(((verts[0], verts[2]), (verts[2], verts[1]), (verts[1], verts[0]))):
        cylinder_between(f"{name}Trim_{index}", start, end, .22, trim, parent, 8)
    return face


def build_main_building():
    clear_scene()
    root = bpy.data.objects.new("MainBuilding", None)
    bpy.context.collection.objects.link(root)
    warm_root = bpy.data.objects.new("WarmWindows", None)
    bpy.context.collection.objects.link(warm_root)
    warm_root.parent = root

    red = material("Oxide red brick", (0.33, 0.09, 0.10), roughness=.78)
    red_dark = material("Brick shadow", (0.20, 0.045, 0.055), roughness=.82)
    limestone = material("Warm limestone", (0.72, 0.66, 0.57), roughness=.58)
    pale = material("Carved pale stone", (0.84, 0.79, 0.70), roughness=.64)
    glass = material("Blue dusk glass", (0.028, 0.07, 0.105), metallic=.10, roughness=.18)
    warm = material("Warm lit windows", (0.38, 0.14, 0.035), roughness=.26, emission=(1.0, .29, .055), strength=2.2)
    roof = material("Slate roof", (.11, .12, .15), metallic=.05, roughness=.72)

    # Seven joined sections trace the broad U-shaped facade visible in both walk-by videos.
    segments = [
        ("CentralSection", 0, 0, 0, 74),
        ("InnerWing_L", -50, -3.0, -4.5, 40), ("InnerWing_R", 50, -3.0, 4.5, 40),
        ("MiddleWing_L", -86, -10.0, -10.0, 40), ("MiddleWing_R", 86, -10.0, 10.0, 40),
        ("CurvedWing", -119, -21.0, -15.5, 36), ("CurvedWing_R", 119, -21.0, 15.5, 36),
    ]
    top_arch_named = ground_arch_named = False
    side_pediment_named = False
    for segment_name, center_x, center_y, angle, width in segments:
        segment = bpy.data.objects.new(segment_name, None)
        bpy.context.collection.objects.link(segment)
        segment.location = (center_x, center_y, 0)
        segment.rotation_euler.z = math.radians(angle)
        segment.parent = root
        front_y = -11.72
        rear_y = 11.72
        box(f"{segment_name}_Shell", (width, 23, 33), (0, 0, 16.5), red, segment, .16)
        box(f"{segment_name}_StoneBase", (width + .4, 1.0, 5.5), (0, front_y - .08, 2.75), limestone, segment, .10)
        box(f"{segment_name}_BaseCornice", (width + .8, 1.12, .55), (0, front_y - .10, 5.7), pale, segment, .06)
        box(f"{segment_name}_UpperCornice", (width + .8, 1.08, .58), (0, front_y - .10, 26.1), pale, segment, .06)
        box(f"{segment_name}_RoofCornice", (width + 1.2, 1.18, .70), (0, front_y - .08, 32.65), pale, segment, .07)
        box(f"{segment_name}_RearStoneBase", (width + .4, 1.0, 5.5), (0, rear_y + .08, 2.75), limestone, segment, .10)
        box(f"{segment_name}_RearBaseCornice", (width + .8, 1.12, .55), (0, rear_y + .10, 5.7), pale, segment, .06)
        box(f"{segment_name}_RearUpperCornice", (width + .8, 1.08, .58), (0, rear_y + .10, 26.1), pale, segment, .06)
        box(f"{segment_name}_RearRoofCornice", (width + 1.2, 1.18, .70), (0, rear_y + .08, 32.65), pale, segment, .07)
        box(f"{segment_name}_RoofCap", (width, 21.6, .48), (0, 0, 33.05), roof, segment, .08)

        columns = max(5, round(width / 7.1))
        step = (width - 5.0) / columns
        for col in range(columns):
            x = -((columns - 1) * step) / 2 + col * step
            # Five rectangular teaching floors with relief panels below each opening.
            for floor in range(5):
                z = 8.0 + floor * 3.75
                window_mat = warm if (floor * 7 + col * 3) % 9 in (0, 3) else glass
                box(f"Window_{segment_name}_{floor}_{col}", (step * .46, .28, 2.25), (x, front_y - .24, z), window_mat, segment, .035)
                box(f"ReliefPanel_{segment_name}_{floor}_{col}", (step * .48, .34, .48), (x, front_y - .28, z - 1.48), pale, segment, .025)
                rear_name = "RearFacadeWindow" if col == 0 and floor == 0 else f"RearWindow_{segment_name}_{floor}_{col}"
                box(rear_name, (step * .46, .28, 2.25), (x, rear_y + .24, z), window_mat, segment, .035)
                box(f"RearReliefPanel_{segment_name}_{floor}_{col}", (step * .48, .34, .48), (x, rear_y + .28, z - 1.48), pale, segment, .025)
            if col % 2 == 0:
                box(f"Pilaster_{segment_name}_{col}", (.82, 1.12, 20.4), (x - step * .55, front_y - .14, 16.0), limestone, segment, .06)
                box(f"RearPilaster_{segment_name}_{col}", (.82, 1.12, 20.4), (x - step * .55, rear_y + .14, 16.0), limestone, segment, .06)

        # Top-floor and ground-floor arched windows are the strongest identifying feature.
        arch_columns = max(2, round(width / 13.0))
        arch_step = (width - 8.0) / arch_columns
        for col in range(arch_columns):
            x = -((arch_columns - 1) * arch_step) / 2 + col * arch_step
            top_name = "TopArchWindow" if not top_arch_named else f"TopArchWindow_{segment_name}_{col}"
            top_arch_named = True
            arched_panel(f"{top_name}_Frame", 6.35, 4.0, .42, (x, front_y - .22, 29.3), pale, segment)
            arched_panel(top_name, 5.35, 3.25, .34, (x, front_y - .47, 29.25), glass, segment)
            if segment_name != "CentralSection" or abs(x) > 10:
                ground_name = "GroundArchWindow" if not ground_arch_named else f"GroundArchWindow_{segment_name}_{col}"
                ground_arch_named = True
                arched_panel(f"{ground_name}_Frame", 6.5, 4.5, .46, (x, front_y - .37, 2.9), pale, segment)
                arched_panel(ground_name, 5.45, 3.7, .34, (x, front_y - .66, 2.9), glass, segment)
            arched_panel(f"RearTopArchFrame_{segment_name}_{col}", 6.35, 4.0, .42, (x, rear_y + .22, 29.3), pale, segment)
            arched_panel(f"RearTopArchWindow_{segment_name}_{col}", 5.35, 3.25, .34, (x, rear_y + .47, 29.25), glass, segment)
            if segment_name != "CentralSection" or abs(x) > 10:
                arched_panel(f"RearGroundFrame_{segment_name}_{col}", 6.5, 4.5, .46, (x, rear_y + .37, 2.9), pale, segment)
                rear_ground_name = "RearGroundWindow" if col == 0 else f"RearGroundWindow_{segment_name}_{col}"
                arched_panel(rear_ground_name, 5.45, 3.7, .34, (x, rear_y + .66, 2.9), glass, segment)

        if segment_name in ("MiddleWing_L", "MiddleWing_R"):
            name = "SidePediment" if not side_pediment_named else "SidePediment_R"
            side_pediment_named = True
            pediment(name, segment, min(22, width - 6), front_y - .42, 32.2, 4.7, red, pale)
            bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.9, depth=.35, location=(0, front_y - .72, 34.0), rotation=(math.pi / 2, 0, 0))
            medallion = bpy.context.object
            medallion.name = f"{name}Medallion"
            medallion.data.materials.append(pale)
            medallion.parent = segment

    box("RearEntranceStone", (16.5, 1.6, 5.5), (0, 12.05, 2.75), limestone, root, .12)
    for x in [-4.2, 0, 4.2]:
        name = "RearDoor" if x == 0 else f"RearDoor_{x}"
        box(name, (3.1, .34, 4.2), (x, 12.92, 2.25), warm if x == 0 else glass, root, .07)
    box("RearEntranceCanopy", (17.5, 2.5, .5), (0, 12.5, 5.9), pale, root, .09)

    # Narrower, more accurate central pavilion and entrance.
    box("CentralProjectingBay", (31.5, 2.4, 27.2), (0, -12.1, 17.5), red_dark, root, .14)
    for x in [-11.2, -5.6, 0, 5.6, 11.2]:
        box("CentralPilaster", (.92, 1.18, 21.0), (x, -13.34, 16.7), pale, root, .07)
        for floor in range(5):
            z = 8.0 + floor * 3.75
            box("CentralWindow", (3.4, .31, 2.3), (x, -13.47, z), glass if (floor + round(x)) % 4 else warm, root, .035)
    box("EntranceStone", (22.5, 3.2, 5.5), (0, -14.0, 2.75), limestone, root, .12)
    for x in [-6.8, -2.25, 2.25, 6.8]:
        box("EntranceColumn", (.82, 1.05, 5.8), (x, -15.45, 3.25), pale, root, .08)
    for x in [-4.5, 0, 4.5]:
        box("EntranceDoor", (3.2, .34, 4.2), (x, -15.72, 2.25), warm if x == 0 else glass, root, .07)
    box("EntranceCanopy", (23.5, 4.2, .60), (0, -14.0, 6.35), pale, root, .09)

    pediment("CentralPediment", root, 31.5, -13.35, 32.1, 5.8, red, pale)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=1.15, depth=.42, location=(0, -13.68, 34.1), rotation=(math.pi / 2, 0, 0))
    crest = bpy.context.object
    crest.name = "UniversityCrestMedallion"
    crest.data.materials.append(pale)
    crest.parent = root
    export_glb("main-building.glb")


def build_stone():
    clear_scene()
    root = bpy.data.objects.new("PlazaStone", None)
    bpy.context.collection.objects.link(root)
    planter_root = bpy.data.objects.new("StonePlanter", None)
    bpy.context.collection.objects.link(planter_root)
    planter_root.parent = root

    granite = material("Peach granite", (.55, .22, .16), roughness=.58)
    dark_vein = material("Grey green mineral", (.12, .16, .15), metallic=.05, roughness=.5)
    light_vein = material("Cream mineral", (.75, .56, .42), roughness=.48)
    curb = material("Planter granite", (.39, .36, .33), roughness=.72)
    soil = material("Dark soil", (.055, .032, .022), roughness=.95)

    outline = [(-2.8, 0), (-3.1, 1.3), (-2.85, 3.7), (-2.05, 6.2), (-.85, 8.15), (.2, 8.85), (1.45, 8.1), (2.45, 6.1), (2.9, 3.4), (2.72, .85), (2.35, 0)]
    depth = 2.05
    verts = [(x, -depth / 2, z) for x, z in outline] + [(x, depth / 2, z) for x, z in outline]
    n = len(outline)
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new("IrregularGraniteMesh")
    mesh.from_pydata(verts, [], faces)
    stone = bpy.data.objects.new("GraniteMonolith", mesh)
    bpy.context.collection.objects.link(stone)
    stone.data.materials.append(granite)
    stone.parent = root
    bevel = stone.modifiers.new("Weathered edges", "BEVEL")
    bevel.width = .18
    bevel.segments = 3

    # Raised mineral seams wrap the front and remain legible at gameplay distance.
    veins = [
        ([(-2.7, -1.08, 6.9), (-1.7, -1.08, 6.25), (-.9, -1.08, 5.4), (.15, -1.08, 4.75), (1.2, -1.08, 4.95), (2.55, -1.08, 4.15)], .13, dark_vein),
        ([(-2.75, -1.10, 2.05), (-1.7, -1.10, 2.65), (-.55, -1.10, 2.35), (.65, -1.10, 3.05), (2.2, -1.10, 2.62)], .10, light_vein),
        ([(-1.9, -1.11, .35), (-1.25, -1.11, 1.8), (-.4, -1.11, 2.65), (.25, -1.11, 4.2), (.8, -1.11, 5.9), (1.4, -1.11, 7.5)], .09, dark_vein),
    ]
    for i, (pts, radius, mat) in enumerate(veins):
        curve_stroke(f"MineralVein_{i}", pts, radius, mat, root)
    # Abstract recessed calligraphic strokes echo the real inscription without inventing unreadable wording.
    ink = material("Weathered inscription", (.10, .075, .065), roughness=.82)
    for i, x in enumerate([-.45, .45]):
        for j in range(3):
            z = 6.15 - j * 1.0
            curve_stroke(f"Inscription_{i}_{j}", [(x - .18, -1.13, z + .25), (x + .14, -1.13, z), (x - .10, -1.13, z - .25)], .035, ink, root)

    pw, pd = 13.8, 7.1
    for name, size, loc in [
        ("PlanterFront", (pw, .55, .48), (0, -pd / 2, .28)),
        ("PlanterBack", (pw, .55, .48), (0, pd / 2, .28)),
        ("PlanterLeft", (.48, pd, .48), (-pw / 2, 0, .28)),
        ("PlanterRight", (.48, pd, .48), (pw / 2, 0, .28)),
    ]:
        box(name, size, loc, curb, planter_root, .10)
    box("PlanterSoil", (pw - .8, pd - .8, .18), (0, 0, .18), soil, planter_root, .05)
    export_glb("plaza-stone.glb")


def build_tree():
    clear_scene()
    random.seed(731)
    root = bpy.data.objects.new("AutumnTree", None)
    bpy.context.collection.objects.link(root)
    white_root = bpy.data.objects.new("WhitewashedTrunk", None)
    foliage_root = bpy.data.objects.new("AutumnFoliage", None)
    bpy.context.collection.objects.link(white_root)
    bpy.context.collection.objects.link(foliage_root)
    white_root.parent = root
    foliage_root.parent = root

    bark = material("Dark mature bark", (.075, .042, .032), roughness=.96)
    white = material("Whitewashed bark", (.66, .62, .54), roughness=.93)
    leaves = [
        material("Burgundy leaves", (.22, .025, .035), roughness=.78),
        material("Crimson leaves", (.34, .035, .045), roughness=.75),
        material("Copper leaves", (.31, .09, .035), roughness=.74),
        material("Shadow leaves", (.11, .018, .025), roughness=.82),
    ]

    cylinder_between("WhitewashedLowerTrunk", (0, 0, 0), (.12, .02, 3.1), .48, white, white_root, 12)
    cylinder_between("MainTrunk", (.12, .02, 2.7), (.1, .0, 11.7), .43, bark, root, 12)
    branches = [
        ((.1, 0, 5.0), (-2.5, .2, 11.1)), ((.1, 0, 5.5), (2.8, -.45, 12.2)),
        ((.1, 0, 6.8), (-.9, -.2, 14.8)), ((.1, 0, 7.4), (1.15, .2, 15.4)),
        ((-1.1, .1, 8.4), (-3.7, .75, 13.0)), ((1.35, -.15, 9.2), (4.0, -.9, 13.8)),
        ((-.45, 0, 10.0), (-2.2, .8, 15.3)), ((.55, 0, 10.3), (2.65, .35, 15.6)),
    ]
    for i, (start, end) in enumerate(branches):
        cylinder_between(f"Branch_{i}", start, end, .24 - i * .012, bark, root, 9)
        midpoint = tuple((start[k] + end[k]) / 2 for k in range(3))
        twig_end = (midpoint[0] + (-1 if i % 2 else 1) * 1.0, midpoint[1] + .45, midpoint[2] + 2.0)
        cylinder_between(f"Twig_{i}", midpoint, twig_end, .10, bark, root, 7)

    crown_centers = [(-3.0, .4, 11.8), (-1.8, -.2, 13.0), (-.2, .2, 14.1), (1.5, -.3, 13.6), (3.2, -.7, 12.8), (-1.6, .8, 15.0), (.4, 0, 15.8), (2.4, .45, 15.0), (3.8, -.5, 14.1)]
    for cluster, center in enumerate(crown_centers):
        count = 5 if cluster % 3 else 4
        for leaf in range(count):
            jitter = (random.uniform(-.75, .75), random.uniform(-.6, .6), random.uniform(-.7, .7))
            pos = tuple(center[k] + jitter[k] for k in range(3))
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(.65, 1.05), location=pos)
            obj = bpy.context.object
            obj.name = f"LeafCluster_{cluster:02d}_{leaf:02d}"
            obj.scale = (random.uniform(.75, 1.25), random.uniform(.65, 1.05), random.uniform(.8, 1.35))
            obj.rotation_euler = (random.random(), random.random(), random.random())
            obj.data.materials.append(leaves[(cluster + leaf) % len(leaves)])
            obj.parent = foliage_root
    export_glb("autumn-tree.glb")


if __name__ == "__main__":
    build_main_building()
    build_stone()
    build_tree()
    print(f"Generated hero assets in {OUTPUT}")
