require 'arrow'
require 'smarter_csv'
require 'json'

REFERENCES = ['hg19', 'hg38', 'covid19']
CSV_HEADERS = ["chromosome","start","end","y"]

if ARGV.length < 1
  puts "Too few arguments: Input CSV file is missing"
  exit
end

input_file = ARGV[0] 
reference = ARGV[2] || 'hg19'
output_file = "#{ARGV[0][0..-5]}.arrow" # remove .csv ending

if !REFERENCES.include?(reference)
  puts "Unknown Reference given! Must be one of #{REFERENCES} as defined in settings.json"
  exit
end

dataInput = JSON.parse(File.read("./scripts/csv2arrow/settings.json"))
references = dataInput['coordinates']['sets']
metadata = references[reference]

genomeLength = metadata.map{|c| c['endPoint']}.inject(:+)
boundary = 0
metadata.each do |chromo|
  chromo['length'] = chromo['endPoint']
  chromo['startPlace'] = boundary
  chromo['colorValue'] = Integer(chromo['color'].gsub('#',"0x"))
  boundary += chromo['endPoint']
end
chromoBins = Hash[*metadata.map{|x| [x['chromosome'], x]}.flatten]

def csv_to_arrow(dataframe = [], filename)
  fields = [
    Arrow::Field.new("startPoint", :float),
    Arrow::Field.new("endPoint", :float),
    Arrow::Field.new("y",  :float),
    Arrow::Field.new("color",  :float)
  ]
  schema = Arrow::Schema.new(fields)

  Arrow::FileOutputStream.open(filename, false) do |output|
    Arrow::RecordBatchFileWriter.open(output, schema) do |writer|
      transposed = dataframe.transpose rescue []
      startPoint = transposed[0] rescue []
      endPoint = transposed[1] rescue []
      y = transposed[2] rescue []
      color = transposed[3] rescue []
      columns = [
        Arrow::FloatArray.new(startPoint),
        Arrow::FloatArray.new(endPoint),
        Arrow::FloatArray.new(y),
        Arrow::FloatArray.new(color)
      ]
      record_batch = Arrow::RecordBatch.new(schema, y.length, columns)
      writer.write_record_batch(record_batch)
    end
  end
end

begin
    puts "Started parsing input CSV file at #{input_file}"
    t1 = Time.now
    records = SmarterCSV.process(input_file, {col_sep: ','})
    unless CSV_HEADERS == records.first.keys.map(&:to_s)
      puts "Improper CSV headers! Expect to be #{CSV_HEADERS} but found #{records.first.keys.map(&:to_s)}"
      exit
    end
    puts "First CSV record is: #{records[0].to_h}"
    puts "Last CSV record is: #{records[records.length - 1].to_h}"
    puts "Converting to global reference coordinates"
    records = records.map do |r| 
      chromo = chromoBins["#{r[:chromosome]}"]
      [chromo['startPlace'].to_f + r[:start].to_f,chromo['startPlace'].to_f + r[:end].to_f, r[:y], chromo['colorValue']]
    end
    puts "Sorting records by \"start\" attribute in ascending order"
    records.sort_by!{|x| x.first}
    puts "Loaded #{records.length} records in #{Time.now - t1} seconds"
    puts "Started converting CSV file to Arrow"
    t1 = Time.now
    csv_to_arrow(records, output_file)
    puts "Successfully converted #{input_file} to #{output_file} in #{Time.now - t1} seconds"
    table = Arrow::Table.load(output_file)
    puts "Arrow file #{output_file} contains #{table.n_rows} rows and columns:"
    puts table.schema
    puts "First Arrow record is: #{table.slice(0).to_h}"
    puts "Last Arrow record is: #{table.slice(table.n_rows - 1).to_h}"
rescue Exception => e
    puts "Execution failed with exception: #{e}"
end


