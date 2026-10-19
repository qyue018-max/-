from pathlib import Path

import bpy


VIDEOS = [
    Path(r"D:\学校建模\照片视频\70b9c0cd9c08eadbb06811fc530adbcb.mp4"),
    Path(r"D:\学校建模\照片视频\3f1424ece9857d545ca05f9c8b2f5ca2.mp4"),
]
OUTPUT = Path(__file__).resolve().parents[1] / "qa" / "main-building-video-refs"


def extract(video):
    scene = bpy.context.scene
    if scene.sequence_editor:
        scene.sequence_editor_clear()
    editor = scene.sequence_editor_create()
    strips = editor.strips if hasattr(editor, "strips") else editor.sequences
    strip = strips.new_movie(video.stem, str(video), channel=1, frame_start=1)
    scene.render.image_settings.file_format = "PNG"
    scene.render.resolution_percentage = 35
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.film_transparent = False
    duration = max(1, strip.frame_final_duration)
    for index, ratio in enumerate((.05, .32, .62, .92), 1):
        frame = 1 + round((duration - 1) * ratio)
        scene.frame_set(frame)
        scene.render.filepath = str(OUTPUT / f"{video.stem}-{index}.png")
        bpy.ops.render.render(write_still=True)


OUTPUT.mkdir(parents=True, exist_ok=True)
for path in VIDEOS:
    extract(path)
print(f"Extracted references to {OUTPUT}")
