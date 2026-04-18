@echo off
REM Fake node.exe wrapper - just exits successfully
REM This prevents Gradle from spawning a real Metro bundler
REM The actual JS bundle was already created separately
exit /b 0
