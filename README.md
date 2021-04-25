# pgv
Pan gGnome Viewer

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

Before you get started, in the project directory, you need to run:

### `yarn install`

Make sure you add your own list of sample files at the location /public/datafiles.json

You may find an example datafiles.json file at /public/datafiles0.json

As soon as this is completed, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

## Converter scripts

The project contains a number of scripts for converting between the accepted formats. In particular, the projects uses Apache Arrow as the format for rendering scatterplots and barplots on the reference genome.

At the root project folder, run:

### `ruby ./scripts/csv2arrow/install.rb`

This step is needed to install the required libraries for the CSV to Apache Arrow converter. It uses the default ruby library in your macOS.

### Apache Arrow converter for ScatterPlot data

Assuming installation completed successfully, at the root project folder, run:

### `ruby ./scripts/csv2arrow/scatterplot/convert.rb ./scatterplot.csv`

This scripts converts the given scatterplot.csv CSV input file into the corresponding Apache Arrow file ./scatterplot.arrow in the same folder location. By default, it assumes the hg19 reference. 

The input CSV file needs to comply with the template given in:

### `./scripts/csv2arrow/scatterplot/csv_template.csv`

If you wish to explicitly specify the reference, please pass the flag

### `--ref hg38` 

The accepted values are hg19, hg38, and covid19

### Apache Arrow converter for BarPlot data

Assuming installation completed successfully, at the root project folder, run:

### `ruby ./scripts/csv2arrow/barplot/convert.rb ./barplot.csv`

This scripts converts the given barplot.csv CSV input file into the corresponding Apache Arrow file ./barplot.arrow in the same folder location. By default, it assumes the hg19 reference. 

The input CSV file needs to comply with the template given in:

### `./scripts/csv2arrow/barplot/csv_template.csv`

If you wish to explicitly specify the reference, please pass the flag

### `--ref hg38` 

The accepted values are hg19, hg38, and covid19