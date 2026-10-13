#!/usr/bin/env python3
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WIDTH, HEIGHT = 1024, 1024

# Create high-res 1024x1024 image
img = Image.new("RGB", (WIDTH, HEIGHT), color=(7, 11, 22))
draw = ImageDraw.Draw(img)

# 1. Background radial gradient
for r in range(WIDTH, 0, -2):
    factor = r / WIDTH
    # Deep midnight to dark slate
    r_val = int(7 + (26 - 7) * (1 - factor))
    g_val = int(11 + (30 - 11) * (1 - factor))
    b_val = int(22 + (60 - 22) * (1 - factor))
    draw.ellipse(
        [WIDTH//2 - r, HEIGHT//2 - r, WIDTH//2 + r, HEIGHT//2 + r],
        fill=(r_val, g_val, b_val)
    )

# 2. Ambient soft indigo glow in the center
glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
for rad in range(320, 20, -10):
    alpha = int(28 * (1 - rad / 320))
    glow_draw.ellipse(
        [WIDTH//2 - rad, HEIGHT//2 - 60 - rad, WIDTH//2 + rad, HEIGHT//2 - 60 + rad],
        fill=(99, 102, 241, alpha)
    )
glow = glow.filter(ImageFilter.GaussianBlur(radius=30))
img.paste(glow, (0, 0), glow)

# 3. Outer macOS-style rounded icon border
border_box = [16, 16, WIDTH - 16, HEIGHT - 16]
border_img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
border_draw = ImageDraw.Draw(border_img)
border_draw.rounded_rectangle(border_box, radius=210, outline=(255, 255, 255, 30), width=4)
img.paste(border_img, (0, 0), border_img)

# Helper function for drawing gradients onto cards
def create_card(w, h, color_top, color_bottom, radius=42):
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    c_draw = ImageDraw.Draw(card)
    # Linear vertical gradient
    for y in range(h):
        t = y / float(h)
        r = int(color_top[0] * (1 - t) + color_bottom[0] * t)
        g = int(color_top[1] * (1 - t) + color_bottom[1] * t)
        b = int(color_top[2] * (1 - t) + color_bottom[2] * t)
        c_draw.line([(0, y), (w, y)], fill=(r, g, b, 255))
    
    # Mask to rounded rectangle
    mask = Image.new("L", (w, h), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
    
    card.putalpha(mask)
    
    # Draw glossy inner stroke
    stroke_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(stroke_layer)
    s_draw.rounded_rectangle([1, 1, w - 2, h - 2], radius=radius, outline=(255, 255, 255, 90), width=3)
    card = Image.alpha_composite(card, stroke_layer)
    return card

# 4. Back Card (File 2) - Violet / Magenta Gradient
back_w, back_h = 360, 470
back_card = create_card(back_w, back_h, (147, 51, 234), (217, 70, 239), radius=44)
b_draw = ImageDraw.Draw(back_card)
# Document placeholder lines on back card
for idx, (lw, alpha) in enumerate([(160, 160), (220, 100), (200, 100), (140, 100)]):
    y_pos = 140 + idx * 40
    b_draw.rounded_rectangle([50, y_pos, 50 + lw, y_pos + 16], radius=8, fill=(255, 255, 255, alpha))

# Rotate back card 12 degrees
back_rotated = back_card.rotate(-12, resample=Image.BICUBIC, expand=True)

# Shadow for back card
back_shadow = Image.new("RGBA", back_rotated.size, (0, 0, 0, 0))
s_mask = back_rotated.split()[3]
back_shadow.paste((139, 92, 246, 120), (0, 0), s_mask)
back_shadow = back_shadow.filter(ImageFilter.GaussianBlur(radius=28))

back_x, back_y = 380, 200
img.paste(back_shadow, (back_x + 10, back_y + 15), back_shadow)
img.paste(back_rotated, (back_x, back_y), back_rotated)

# 5. Front Card (File 1) - Cyan / Sapphire / Indigo Gradient
front_w, front_h = 390, 490
front_card = create_card(front_w, front_h, (6, 182, 212), (79, 70, 229), radius=48)
f_draw = ImageDraw.Draw(front_card)

# Top fold corner
fold_poly = [(front_w - 95, 0), (front_w, 95), (front_w - 95, 95)]
f_draw.polygon(fold_poly, fill=(15, 23, 42, 110))
f_draw.line([(front_w - 95, 0), (front_w - 95, 95), (front_w, 95)], fill=(255, 255, 255, 120), width=3)

# Draw bold Stylized "D" Emblem with duplicate cards inside
d_cx, d_cy = 195, 240
# Outer D loop
f_draw.arc([d_cx - 90, d_cy - 100, d_cx + 70, d_cy + 100], start=-90, end=90, fill=(255, 255, 255, 240), width=24)
f_draw.line([(d_cx - 90, d_cy - 100), (d_cx - 10, d_cy - 100)], fill=(255, 255, 255, 240), width=24)
f_draw.line([(d_cx - 90, d_cy + 100), (d_cx - 10, d_cy + 100)], fill=(255, 255, 255, 240), width=24)
f_draw.line([(d_cx - 90, d_cy - 100), (d_cx - 90, d_cy + 100)], fill=(255, 255, 255, 240), width=24)

# Duplicate Twin Icons nested inside the D
f_draw.rounded_rectangle([d_cx - 40, d_cy - 45, d_cx + 15, d_cy + 30], radius=8, outline=(255, 255, 255, 180), width=8)
f_draw.rounded_rectangle([d_cx - 20, d_cy - 25, d_cx + 35, d_cy + 50], radius=8, fill=(255, 255, 255, 230))

# Bottom metadata stripes
f_draw.rounded_rectangle([55, 390, 200, 404], radius=7, fill=(255, 255, 255, 160))
f_draw.rounded_rectangle([55, 418, 290, 430], radius=6, fill=(255, 255, 255, 90))

# Front card shadow & paste
front_shadow = Image.new("RGBA", front_card.size, (0, 0, 0, 0))
f_mask = front_card.split()[3]
front_shadow.paste((6, 182, 212, 130), (0, 0), f_mask)
front_shadow = front_shadow.filter(ImageFilter.GaussianBlur(radius=32))

front_x, front_y = 230, 215
img.paste(front_shadow, (front_x, front_y + 20), front_shadow)
img.paste(front_card, (front_x, front_y), front_card)

# 6. Glowing Laser Scanner Beam cutting horizontally
laser_img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
l_draw = ImageDraw.Draw(laser_img)
laser_y = 475

# Broad cyan glow
for glow_h in [28, 16, 8]:
    alpha = int(120 / (glow_h / 4))
    l_draw.rounded_rectangle([130, laser_y - glow_h//2, WIDTH - 130, laser_y + glow_h//2], radius=glow_h//2, fill=(56, 189, 248, alpha))

# Core white beam
l_draw.line([(160, laser_y), (WIDTH - 160, laser_y)], fill=(255, 255, 255, 255), width=4)

# Laser nodes on card intersections
l_draw.ellipse([front_x - 12, laser_y - 12, front_x + 12, laser_y + 12], fill=(56, 189, 248, 120))
l_draw.ellipse([front_x - 6, laser_y - 6, front_x + 6, laser_y + 6], fill=(255, 255, 255, 255))
l_draw.ellipse([front_x + front_w - 12, laser_y - 12, front_x + front_w + 12, laser_y + 12], fill=(56, 189, 248, 120))
l_draw.ellipse([front_x + front_w - 6, laser_y - 6, front_x + front_w + 6, laser_y + 6], fill=(255, 255, 255, 255))

laser_img = laser_img.filter(ImageFilter.GaussianBlur(radius=2))
img.paste(laser_img, (0, 0), laser_img)

# 7. Sleek Typography at Bottom
# Draw "DUPLISOFT" title
text_img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
t_draw = ImageDraw.Draw(text_img)

# Try loading system font, fallback to default
title_font = None
sub_font = None
font_paths = [
    "/System/Library/Fonts/SFProDisplay-Bold.otf",
    "/System/Library/Fonts/SFPro-Bold.otf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
]
for fp in font_paths:
    try:
        title_font = ImageFont.truetype(fp, 68)
        sub_font = ImageFont.truetype(fp, 22)
        break
    except Exception:
        continue

if not title_font:
    title_font = ImageFont.load_default()
    sub_font = ImageFont.load_default()

title_text = "DUPLISOFT"
sub_text = "DUPLICATE  FILE  FINDER  &  PREVIEWER"

t_bbox = t_draw.textbbox((0, 0), title_text, font=title_font)
t_w = t_bbox[2] - t_bbox[0]
t_draw.text(((WIDTH - t_w) // 2, 815), title_text, fill=(255, 255, 255), font=title_font)

s_bbox = t_draw.textbbox((0, 0), sub_text, font=sub_font)
s_w = s_bbox[2] - s_bbox[0]
t_draw.text(((WIDTH - s_w) // 2, 895), sub_text, fill=(148, 163, 184), font=sub_font)

img.paste(text_img, (0, 0), text_img)

# 8. Save high-quality JPG image
output_path = "/Users/mahesh_bhosle/Desktop/DupliSoft/duplisoft_logo.jpg"
img.save(output_path, "JPEG", quality=98)
print(f"Logo generated successfully at: {output_path}")

# Also save a copy inside src/assets/ for app UI use
asset_path = "/Users/mahesh_bhosle/Desktop/DupliSoft/src/assets/duplisoft_logo.jpg"
img.save(asset_path, "JPEG", quality=98)
print(f"Logo asset copy saved at: {asset_path}")
