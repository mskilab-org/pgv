puts "Installing required Ruby libraries..."
puts "You are currently running:"
system("ruby -v")
puts "Installing red-arrow gem ..."
system("gem install red-arrow --no-ri --no-rdoc")
puts "Installing smarter_csv gem ..."
system("gem install smarter_csv --no-ri --no-rdoc")
puts "Installing json gem ..."
system("gem install json --no-ri --no-rdoc")