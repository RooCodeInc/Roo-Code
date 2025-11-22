export const sampleBashContent = `
#!/bin/bash

# Function definition - demonstrates basic function structure
function multi_line_function() {
    local param1=\$1
    local param2=\$2
    echo "Processing \$param1 and \$param2"
    return 0
}

# Alternative function syntax
another_function() {
    local result=""
    for i in {1..5}; do
        result+="\$i "
    done
    echo "\$result"
}

# Variable assignments and exports
GLOBAL_VAR="global_value"
export PATH_VAR="/usr/local/bin:\$PATH"
readonly CONSTANT_VAR="immutable"
declare -a array_var=(
    "element1"
    "element2"
    "element3"
)

# Alias definitions
alias ll='ls -la'
alias grep='grep --color=auto'
alias ..='cd ..'

# Complex variable assignment with command substitution
CURRENT_DIR=\$(
    pwd | 
    sed 's/\\/home\\///' |
    tr '/' '-'
)

# Here document example
cat <<EOF > output.txt
    This is a multi-line
    here document that spans
    several lines for testing
EOF

# Case statement with multiple patterns
case "\$1" in
    start|START)
        echo "Starting service..."
        start_service
        ;;
    stop|STOP)
        echo "Stopping service..."
        stop_service
        ;;
    restart|RESTART)
        echo "Restarting service..."
        restart_service
        ;;
    *)
        echo "Unknown command"
        exit 1
        ;;
esac

# If statement with multiple conditions
if [[ -f "\$CONFIG_FILE" && -r "\$CONFIG_FILE" ]]; then
    source "\$CONFIG_FILE"
    echo "Configuration loaded"
elif [[ -f "\$DEFAULT_CONFIG" ]]; then
    source "\$DEFAULT_CONFIG"
    echo "Default configuration loaded"
else
    echo "No configuration found"
    exit 1
fi

# While loop with read
while IFS= read -r line; do
    process_line "\$line"
    counter=\$((counter + 1))
done < input.txt

# For loop with array iteration
for element in "\${array_var[@]}"; do
    echo "Processing: \$element"
    transform_element "\$element"
done

# Pipeline example
cat data.txt |
    grep "pattern" |
    sort -u |
    head -20 > results.txt

# Function with arithmetic operations
calculate_sum() {
    local sum=0
    for num in "\$@"; do
        sum=\$((sum + num))
    done
    echo \$sum
}

# Source another script
source ./config.sh
. ./utils.sh

# Array manipulation
declare -A associative_array
associative_array["key1"]="value1"
associative_array["key2"]="value2"

# Test command examples
if [ -z "\$VAR" ]; then
    echo "Variable is empty"
fi

if [[ "\$VAR" =~ ^[0-9]+\$ ]]; then
    echo "Variable is numeric"
fi

# Command substitution in arithmetic context
result=\$((10 + \$(get_value)))

# Redirection examples
exec 3< input.txt
exec 4> output.txt
exec 5>&1

# Trap signal handling
trap cleanup EXIT
trap 'echo "Interrupted"' INT TERM
`

export default {
	path: "test.sh",
	content: sampleBashContent,
}
