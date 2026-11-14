#!/usr/bin/env python3
"""Assembles ../index.html (the one page the APK ships and the phone downloads) from the pieces in this folder.
   python3 build.py     fonts.css holds the three embedded JetBrains Mono weights (OFL), subset to what the page uses."""
import pathlib
here = pathlib.Path(__file__).parent
r = lambda n: (here / n).read_text(encoding="utf-8")
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,interactive-widget=resizes-content">
<meta name="color-scheme" content="dark">
<title>SHELL</title>
<style>
{r("fonts.css")}
{r("shell.css")}</style>
</head>
<body>
{r("body.html")}<script>
{r("mock.js")}</script>
<script>
{r("shell.js")}</script>
</body>
</html>
"""
(here.parent / "index.html").write_text(html, encoding="utf-8")
print("index.html", len(html.encode()), "bytes")
