desc 'Build documentation site locally'
task :serve do
  Dir.chdir('docs') do
    # Only run bundle install if Gemfile.lock doesn't exist
    sh 'bundle install' unless File.exist?('Gemfile.lock')
    sh 'bundle exec jekyll serve'
  end
end

# Set default task
task default: :serve