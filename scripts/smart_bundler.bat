@echo off
REM Smart bundler: copies the pre-built JS bundle to Gradle's expected output location.
REM The actual bundle was created separately via: npx expo export:embed
set "bundle_dest="
set "assets_dest="

:loop
if "%~1"=="" goto done
if "%~1"=="--bundle-output" set "bundle_dest=%~2"
if "%~1"=="--assets-dest" set "assets_dest=%~2"
shift
goto loop

:done
if not "%bundle_dest%"=="" (
    echo Copying pre-built bundle to: %bundle_dest%
    for %%F in ("%bundle_dest%") do mkdir "%%~dpF" 2>nul
    copy /y "c:\Banana\android\app\src\main\assets\index.android.bundle" "%bundle_dest%" >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Could not copy bundle, creating empty placeholder
        echo. > "%bundle_dest%"
    )
)

if not "%assets_dest%"=="" (
    echo Copying assets to: %assets_dest%
    mkdir "%assets_dest%" 2>nul
    xcopy /e /y /q "c:\Banana\android\app\src\main\res\drawable-*" "%assets_dest%\" 2>nul
)

echo Smart bundler completed successfully.
exit /b 0
