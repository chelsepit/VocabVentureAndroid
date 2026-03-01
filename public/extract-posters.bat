@echo off
:: ============================================================
:: extract-posters.bat
:: Extracts the first frame of every story segment video
:: as a JPG poster image, used by story-viewer.js to show
:: a thumbnail while the video is still loading.
::
:: REQUIREMENTS:
::   FFmpeg must be installed and on your PATH.
::   Download from: https://ffmpeg.org/download.html
::   Or via winget: winget install ffmpeg
::
:: HOW TO RUN:
::   Place this file in your PROJECT ROOT (same level as /assets)
::   then double-click it, or run from terminal:
::     cd C:\path\to\your\project
::     extract-posters.bat
::
:: OUTPUT:
::   assets/videos/story-1/segment-1-poster.jpg
::   assets/videos/story-1/segment-2-poster.jpg
::   ... etc for every story and segment found
:: ============================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo  VocabVenture - Poster Frame Extractor
echo ============================================================
echo.

:: Check ffmpeg is available
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo ERROR: ffmpeg not found on PATH.
    echo.
    echo Install it with:  winget install ffmpeg
    echo Or download from: https://ffmpeg.org/download.html
    echo.
    pause
    exit /b 1
)

set VIDEO_DIR=assets\videos
set COUNT=0
set SKIP=0

if not exist "%VIDEO_DIR%" (
    echo ERROR: Directory "%VIDEO_DIR%" not found.
    echo Make sure you are running this script from your project root.
    echo.
    pause
    exit /b 1
)

:: Loop through every story folder
for /d %%S in ("%VIDEO_DIR%\story-*") do (
    echo Processing: %%S
    
    :: Loop through every .mp4 in this story folder
    for %%F in ("%%S\*.mp4") do (
        set "MP4=%%F"
        set "POSTER=%%~dpnF-poster.jpg"
        
        :: Skip if poster already exists
        if exist "!POSTER!" (
            echo   [SKIP] %%~nxF  ^(poster already exists^)
            set /a SKIP+=1
        ) else (
            echo   [EXTRACT] %%~nxF  --^>  %%~nF-poster.jpg
            ffmpeg -loglevel error -i "%%F" -vframes 1 -q:v 2 -vf "scale=iw:ih" "!POSTER!"
            if errorlevel 1 (
                echo   [ERROR] Failed to extract frame from %%~nxF
            ) else (
                set /a COUNT+=1
            )
        )
    )
    echo.
)

echo ============================================================
echo  Done!
echo  Extracted : %COUNT% new poster(s)
echo  Skipped   : %SKIP% already existed
echo ============================================================
echo.
pause