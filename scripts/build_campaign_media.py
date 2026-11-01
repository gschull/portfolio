#!/usr/bin/env python3
"""Render original branded social creative and a silent vertical YouTube/TikTok short.

Requires Pillow and ffmpeg. No external images, tracking, APIs, or user data.
Run: python3 scripts/build_campaign_media.py --out /path/to/public/media
"""
from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BG = (12, 21, 25)
GREEN = (182, 245, 130)
TEXT = (244, 248, 246)
MUTED = (175, 194, 199)
BLUE = (50, 111, 130)
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(sz: int, bold: bool = False):
    path = FONT_BOLD if bold else FONT_REG
    try:
        return ImageFont.truetype(path, sz)
    except OSError:
        return ImageFont.load_default()

def card(draw, bounds, fill, outline=None, radius=25, width=2):
    draw.rounded_rectangle(bounds, radius=radius, fill=fill, outline=outline, width=width)

def textlines(draw, xy, lines, fill, size, bold=False, gap=1.25):
    x,y=xy
    face=font(size,bold)
    for line in lines:
        draw.text((x,y),line,font=face,fill=fill,stroke_width=0)
        y+=int(size*gap)
    return y

def draw_art(w: int, h: int, *, headline: list[str], subtitle: list[str], callout: str, path: Path):
    im=Image.new("RGB",(w,h),BG)
    px=im.load()
    # Subtle deep blue tinted diagonal glow; independent of third-party media.
    for y in range(h):
        for x in range(w):
            d=abs((x/w)-(y/h)*0.42-0.83)
            glow=max(0.0,1-d*2.6)
            px[x,y]=(int(12+glow*11),int(21+glow*22),int(25+glow*30))
    d=ImageDraw.Draw(im)
    s=w/1080
    def u(v):return max(1,round(v*s))
    pad=u(74)
    # Accent bars and wireframe data flow.
    d.rounded_rectangle((pad,u(76),pad+u(14),u(165)),radius=u(6),fill=GREEN)
    textlines(d,(pad+u(40),u(87)),["gschull   /   ENGINEERING"],GREEN,u(25),True)
    d.line((pad,u(206),w-pad,u(206)),fill=(56,86,92),width=u(2))
    top=u(265)
    top=textlines(d,(pad,top),headline,TEXT,u(61),True,gap=1.25)
    top+=u(25)
    top=textlines(d,(pad,top),subtitle,MUTED,u(28),False,gap=1.47)
    # Four dataflow nodes connected with a guaranteed readable schematic.
    chartY=max(top+u(68),round(h*0.55))
    x1,x2,x3=pad,w//2,w-pad
    for aa,bb in [(x1,x2),(x2,x3)]:
        d.line((aa,chartY,bb,chartY),fill=BLUE,width=u(8))
    for idx,x in enumerate((x1,x2,x3)):
        rr=u(25)
        d.ellipse((x-rr,chartY-rr,x+rr,chartY+rr),fill=GREEN if idx==1 else (57,137,148),outline=(244,248,246),width=u(3))
    for label,x in [("DATA",x1),("AUTOMATE",x2),("RESULTS",x3)]:
        box=d.textbbox((0,0),label,font=font(u(21),True))
        d.text((x-(box[2]-box[0])/2,chartY+u(50)),label,fill=MUTED,font=font(u(21),True))
    y2=chartY+u(130)
    card(d,(pad,y2,w-pad,y2+u(158)),(23,43,49),outline=(64,118,112),radius=u(25),width=u(3))
    textlines(d,(pad+u(32),y2+u(26)),["SQL Server  /  Python  /  C# .NET", "PowerShell  /  Microsoft 365"],TEXT,u(28),True,gap=1.7)
    foot_y=h-u(205)
    d.line((pad,foot_y,w-pad,foot_y),fill=(58,85,93),width=u(2))
    textlines(d,(pad,foot_y+u(35)),[callout],GREEN,u(28),True)
    textlines(d,(pad,foot_y+u(88)),["gschull.github.io/portfolio"],TEXT,u(29),True)
    path.parent.mkdir(parents=True,exist_ok=True)
    im.save(path,"JPEG",quality=90,optimize=True,subsampling=0)
    return path

def make_short(slides: list[Path], dest: Path, fps: int = 24):
    ffmpeg=shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg required to generate video")
    concat=dest.parent/"slides.concat"
    with concat.open("w",encoding="utf-8") as f:
        for slide in slides:
            f.write("file '"+str(slide.resolve()).replace("'","'\\''")+"'\n")
            f.write("duration 4\n")
        f.write("file '"+str(slides[-1].resolve()).replace("'","'\\''")+"'\n")
    command=[ffmpeg,"-nostdin","-hide_banner","-loglevel","error","-y",
       "-f","concat","-safe","0","-i",str(concat),
       "-vf",f"fps={fps},format=yuv420p","-c:v","libx264","-preset","fast",
       "-crf","27","-movflags","+faststart","-t","12",str(dest)]
    subprocess.run(command,check=True,timeout=160)
    concat.unlink()
    if dest.stat().st_size < 1000:
        raise RuntimeError("Video output unexpectedly short")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    o=args.out
    draw_art(1080,1350,headline=["Fix reporting.", "Automate work."],
             subtitle=["Remote SQL, systems integration,", "and workflow engineering."],
             callout="Let's solve the bottleneck.",path=o/"launch-instagram.jpg")
    draw_art(1000,1500,headline=["Less manual work.", "Better systems."],
             subtitle=["SQL reporting  /  Integration", "Automation  /  Microsoft 365"],
             callout="Explore the engineering portfolio.",path=o/"launch-pinterest.jpg")
    draw_art(1080,1920,headline=["Your systems", "should work", "together."],
             subtitle=["Reporting, scripting, APIs, and", "business workflow automation."],
             callout="Explore real engineering work.",path=o/"launch-tiktok.jpg")
    slide_data=[
      (["Your systems", "should work", "together."],["When reports and workflows", "fight your team, fix the system."],"REMOTE ENGINEERING"),
      (["SQL reporting.", "API integration.", "Automation."],["Practical changes. Validated results.", "Documented, maintainable handoff."],"SCOPED PROJECTS"),
      (["Less manual work.", "More reliable", "systems."],["SQL Server / Python / PowerShell", "C# .NET / Microsoft 365"],"VIEW THE PORTFOLIO")
    ]
    slide_paths=[]
    for i,(head,sub,foot) in enumerate(slide_data,1):
        path=o/f"short-slide-{i}.jpg"
        draw_art(720,1280,headline=head,subtitle=sub,callout=foot,path=path)
        slide_paths.append(path)
    make_short(slide_paths,o/"launch-short.mp4")
    # YouTube cover image is a genuine rendered thumbnail, not a generated person.
    draw_art(1280,720,headline=["Automate the", "right work."],
             subtitle=["SQL  /  APIs  /  Microsoft 365"],
             callout="Remote engineering",path=o/"launch-youtube-thumb.jpg")
    for file in sorted(o.iterdir()):
        print(file.name,file.stat().st_size)

if __name__=="__main__":
    main()
