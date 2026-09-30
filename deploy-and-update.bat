@echo off
echo Deploying CDK stack...
cd cdk
call cdk deploy
if %errorlevel% neq 0 (
    echo CDK deployment failed!
    exit /b %errorlevel%
)

echo.
echo Updating UI configuration...
cd ..\update_ui
call npm run update-config
if %errorlevel% neq 0 (
    echo UI configuration update failed!
    exit /b %errorlevel%
)

echo.
echo Deployment and configuration update complete!