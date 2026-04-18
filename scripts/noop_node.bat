@echo off
REM This is a no-op bundler that does nothing.
REM The real bundle was already created by expo export:embed.
REM We just need to exit successfully so Gradle continues.
echo Skipping bundle - pre-built bundle already exists.
exit /b 0
