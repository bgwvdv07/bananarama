from PIL import Image, ImageOps
import sys, math

# Retro palettes
PALETTES = {
    "gameboy": [(15, 56, 15), (48, 98, 48), (139, 172, 15), (155, 188, 15)],
    "nes": [
        (84, 84, 84),(0, 30, 116),(8, 16, 144),(48, 0, 136),
        (68, 0, 100),(92, 0, 48),(84, 4, 0),(60, 24, 0),
        (32, 42, 0),(8, 58, 0),(0, 64, 0),(0, 60, 0),
        (0, 50, 60),(0, 0, 0),(152, 150, 152),(8, 76, 196),
    ]
}

# ----- Utilities -----
def apply_palette(img, palette_name):
    """Apply retro palette safely for RGBA input."""
    palette = PALETTES[palette_name]
    pal_img = Image.new("P", (1, 1))
    flat = []
    for r,g,b in palette:
        flat.extend([r,g,b])
    flat += [0]*(768-len(flat))
    pal_img.putpalette(flat)
    return img.convert("RGB").quantize(palette=pal_img).convert("RGBA")

def crop_head_shoulder(img, scale=0.8):
    """Crop to square around head & shoulders."""
    w,h = img.size
    min_dim = min(w,h)
    crop_size = int(min_dim * scale)
    left = (w - crop_size)//2
    top = (h - crop_size)//2
    return img.crop((left, top, left+crop_size, top+crop_size))

def make_base_sprite(input_file, sprite_size=64, palette="nes"):
    """Generate a recognizable pixel-art sprite."""
    img = Image.open(input_file)

    # Step 1: crop to head & shoulders
    img = crop_head_shoulder(img, scale=0.8)

    # Step 2: upscale to retain detail
    img = img.resize((256,256), Image.LANCZOS)

    # Step 3: downscale to final sprite size (pixel art)
    img = img.resize((sprite_size,sprite_size), Image.NEAREST)

    # Step 4: apply palette
    if palette:
        img = apply_palette(img, palette)

    return img

# ----- Animation Frames -----
def generate_frames(sprite):
    """Create 6 simple frames: idle, blink, bounce up/down, walk left/right."""
    frames = [sprite]

    # Blink (autocontrast)
    blink = sprite.convert("RGB")
    blink = ImageOps.autocontrast(blink)
    blink = blink.convert("RGBA")
    frames.append(blink)

    # Bounce up/down
    for shift in (-2,2):
        frame = Image.new("RGBA", sprite.size, (0,0,0,0))
        frame.paste(sprite, (0, shift))
        frames.append(frame)

    # Walk left/right
    for shift in (-2,2):
        frame = Image.new("RGBA", sprite.size, (0,0,0,0))
        frame.paste(sprite, (shift,0))
        frames.append(frame)

    return frames

# ----- Sprite Sheet -----
def save_sprite_sheet(frames, output_file="sheet.png", layout="horizontal", cols=None):
    """Save frames in horizontal, vertical, or grid layout."""
    sprite_size = frames[0].size[0]  # assume square
    num_frames = len(frames)

    if layout=="vertical":
        sheet_width = sprite_size
        sheet_height = sprite_size*num_frames
        sheet = Image.new("RGBA", (sheet_width,sheet_height))
        for i, f in enumerate(frames):
            sheet.paste(f, (0, i*sprite_size))
    elif layout=="grid":
        if cols is None:
            cols = math.ceil(math.sqrt(num_frames))
        rows = math.ceil(num_frames/cols)
        sheet_width = sprite_size*cols
        sheet_height = sprite_size*rows
        sheet = Image.new("RGBA", (sheet_width, sheet_height))
        for i, f in enumerate(frames):
            x = (i%cols)*sprite_size
            y = (i//cols)*sprite_size
            sheet.paste(f, (x,y))
    else:  # horizontal
        sheet_width = sprite_size*num_frames
        sheet_height = sprite_size
        sheet = Image.new("RGBA", (sheet_width,sheet_height))
        for i, f in enumerate(frames):
            sheet.paste(f, (i*sprite_size,0))

    sheet.save(output_file)
    print(f"✅ Sprite sheet saved as {output_file} ({num_frames} frames, layout={layout})")

# ----- Main -----
if __name__=="__main__":
    if len(sys.argv)<2:
        print("Usage: python full_sprite_sheet.py input.jpg [output.png] [sprite_size] [palette] [layout] [cols]")
    else:
        input_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv)>2 else "sheet.png"
        sprite_size = int(sys.argv[3]) if len(sys.argv)>3 else 64
        palette = sys.argv[4] if len(sys.argv)>4 else "nes"
        layout = sys.argv[5] if len(sys.argv)>5 else "horizontal"
        cols = int(sys.argv[6]) if len(sys.argv)>6 else None

        sprite = make_base_sprite(input_file, sprite_size, palette)
        frames = generate_frames(sprite)
        save_sprite_sheet(frames, output_file, layout, cols)
