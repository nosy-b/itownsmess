#!/bin/bash
set -e # exit on error

USER="your-github-user-name"
PROJECT="your-itowns-project-name"
QUICKSTART="https://github.com/itownsResearch/itowns-quickstart.git"
ITOWNS="https://github.com/itownsResearch/itowns.git"
ORIGIN="https://$USER@github.com/$USER/$PROJECT.git"
BRANCH_QUICKSTART="master"
BRANCH_ITOWNS="master"

echo " # Create the project '$PROJECT' on github : $ORIGIN"
curl -u "$USER" https://api.github.com/user/repos -d "{\"name\":\"$PROJECT\"}"

echo " # Create the root directory : $PROJECT"
mkdir $PROJECT && cd $PROJECT

echo " # Initialize the repository: $PROJECT/master"
mkdir master && cd master
git init
git remote add origin $ORIGIN
git remote add quickstart $QUICKSTART
git remote add itowns $ITOWNS

echo " # Create the master branch from : $QUICKSTART master"
git pull quickstart $BRANCH_QUICKSTART:master
git push -u origin master

echo " # Create the itowns branch from : $ITOWNS master"
git fetch itowns $BRANCH_ITOWNS:itowns
git push -u origin itowns

echo " # Build the itowns branch in a new directory : $PROJECT/itowns"
git branch -D itowns
git clone --single-branch -b itowns $ORIGIN ../itowns
cd ../itowns && git checkout itowns
# npm install # calls "npm run build" --> they changed the scripts in package.json
npm install && npm run prepublishOnly # if not, we can't import the module correctly from itowns directory
npm run doc

echo " # Build master"
cd ../master && git checkout master
npm install file:../itowns
npm install
npm run build
git add . && git commit -m"package.json changed with local itowns" && git push origin master
