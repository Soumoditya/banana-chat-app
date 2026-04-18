@echo off
set "bundle_dest="
set "assets_dest="

:loop
if "%~1"=="" goto done
if "%~1"=="--bundle-output" set "bundle_dest=%~2"
if "%~1"=="--assets-dest" set "assets_dest=%~2"
shift
goto loop

:done
echo Dummy script taking over! Copying pre-built bundle...
if not "%bundle_dest%"=="" (
    mkdir "%~dp0" 2>nul
    copy /y "c:\Banana\android\app\src\main\assets\index.android.bundle" "%bundle_dest%"
)

if not "%assets_dest%"=="" (
    mkdir "%assets_dest%" 2>nul
    xcopy /e /y /q "c:\Banana\android\app\src\main\res\*" "%assets_dest%\"
)

echo Finished copying!
exit 0
