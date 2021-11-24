yarn install

# check if gene files are available and if not then download
if [ ! -s public/genes/hg19.arrow ]; then
    echo 'Downloading hg19.arrow'
    wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg19.arrow
fi
if [ ! -s public/genes/hg19_chr.arrow ]; then
    echo 'Downloading hg19_chr.arrow'
    wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg19_chr.arrow
fi
if [ ! -s public/genes/hg38.arrow ]; then
    echo 'Downloading hg38.arrow'
    wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg38.arrow
fi
if [ ! -s public/genes/hg38_chr.arrow ]; then
    echo 'Downloading hg38_chr.arrow'
    wget -P public/genes https://mskilab.s3.amazonaws.com/pgv/hg38_chr.arrow
fi

yarn start
