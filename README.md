# pgv
Pan gGnome Viewer

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Setting up PGV

### Dependencies

In order to use PGV you need to have the following:
1. [git lfs](https://git-lfs.github.com/) which is used to manage large files stored on github. Please make sure you have git lfs installed on your machine.
2. [Node.js](https://nodejs.org/en/)
3. [yarn](https://yarnpkg.com/)

### Installing PGV

Clone the repository:

```
git clone https://github.com/mskilab/pgv.git
```

Pull files using `git lfs`:

```
cd pgv
git lfs install
git lfs pull
```

Before you get started, in the project directory, you need to run:

```
yarn install
```

Make sure you add your own list of sample files at the location /public/datafiles.json

You may find an example datafiles.json file at /public/datafiles0.json (if you want to use the example data then make sure to change the name of the file from datafiles0.json to datafiles.json)

## Starting the PGV interface

Once you have your files in the right places, you can start the viewer by running:

```
yarn start
```

This runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.


