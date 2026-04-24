@echo off
REM No-op hermesc - bundle already pre-compiled to HBC
REM Copies input to output + creates dummy .map file
setlocal enabledelayedexpansion
set OUTPUT=
set INPUT=
:parse
if "%~1"=="" goto done
if "%~1"=="-out" (set OUTPUT=%~2& shift & shift & goto parse)
if "%~1"=="-emit-binary" (shift & goto parse)
if "%~1"=="-O" (shift & goto parse)
if "%~1"=="-output-source-map" (shift & goto parse)
if "%~1"=="-w" (shift & goto parse)
if "%~1"=="-max-diagnostic-width" (shift & shift & goto parse)
set INPUT=%~1
shift
goto parse
:done
if defined OUTPUT if defined INPUT (
    copy /Y "%INPUT%" "%OUTPUT%" >nul 2>&1
    echo {"version":3,"sources":[],"mappings":""}> "%OUTPUT%.map"
)
exit /b 0
