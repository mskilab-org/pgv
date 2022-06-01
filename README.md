# pgv

Pan gGnome Viewer

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Setting up PGV

### Dependencies

In order to use PGV you need to have the following:

1. [git lfs](https://git-lfs.github.com/) which is used to manage large files stored on github. Please make sure you have git lfs installed on your machine.
2. [Node.js](https://nodejs.org/en/)
3. [yarn](https://yarnpkg.com/)

### Installing PGV (the detailed recipe)

Once you have all dependencies then setting up PGV takes just the following steps:

1. Cloning the repository
2. Running "yarn install"
3. Setting up reference files

To clone the repository run:

```
git clone https://github.com/mskilab/pgv.git
```

Before you get started, you need to run:

```
cd pgv
yarn install
```

To download the reference files you can run the following commands (you can run all if you want all reference files, or just the one the fits the reference that you are using for your data):

```
# hg19 reference gene file
wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg19.arrow
# hg19 (with "chr" prefix in sequence names) reference gene file
wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg19_chr.arrow
# hg38 reference gene file
wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg38.arrow
# hg38 (with "chr" prefix in sequence names) reference gene file
wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg38_chr.arrow
```

Make sure you add your own list of sample files at the location `public/datafiles.json`

You may find an example datafiles.json file at `public/datafiles0.json` (if you want to use the example data then make sure to change the name of the file from `datafiles0.json` to `datafiles.json`)

### Installing PGV (For the impatient)

If you just want to install pgv and test it using the provided demo, then run the following code:

```
git clone https://github.com/mskilab/pgv.git
cd pgv
mv public/datafiles0.json public/datafiles.json
./start.sh # this command will run yarn install, download the reference files and yarn start
```

## Starting the PGV interface

Once you have your files in the right places, you can start the viewer by running:

```
yarn start
```

This runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

## Converting CSV files for coverage data to Apache Arrow

Coverage data CSV files need to have the following structure

```
x,y,chromosome
15001,1.24706213403148,1
```

Where x is the location relevant to the current chromosome, y is the value to render on the vertical axis and chromosome must correspond to the namings of the chromosomes as defined in the ./public/settings.json file.

Such an example CSV coverage file is available in ./scripts/coverage.csv

To convert a coverage CSV file to the respective Apache Arrow file, you need to run the following command on your console

```
node ./src/scripts/csv2arrow.mjs ./scripts/coverage.csv hg19"
```

The above command will parse the csv file ./scripts/coverage.csv using hg19 as the reference and store the generated Apache Arrow file at ./scripts/coverage.arrow

The file is then executable by PGV to render in a scatterplot.
