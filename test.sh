for server in \
  "http://43.142.195.75:8000|deepseek-r1:14b" \
  "http://117.50.193.242:9999|deepseek-r1:70b" \
  "http://111.230.111.224:8008|deepseek-r1:14b" \
  "http://124.221.66.212:7004|deepseek-r1:32b" \
  "http://118.25.143.41:8080|deepseek-r1:70b" \
  "http://134.175.8.117:11434|deepseek-r1:14b" \
  "http://49.232.139.213:11434|deepseek-r1:32b" \
  "http://106.54.208.116:11434|deepseek-r1:14b" \
  "http://81.70.17.33:11434|deepseek-r1:32b" \
  "http://192.222.58.232:8000|deepseek-r1:70b" \
  "http://124.223.45.165:22103|deepseek-r1:32b" \
  "http://47.92.94.52:50001|deepseek-r1:70b" \
  "http://123.56.165.234:11434|deepseek-r1:14b" \
  "http://139.196.93.232:8888|deepseek-r1:14b" \
  "http://47.116.47.23:12345|deepseek-r1:14b" \
  "http://106.15.202.135:18083|deepseek-r1:32b" \
  "http://39.107.101.250:8000|deepseek-r1:32b" \
  "http://101.37.21.72:12345|deepseek-r1:14b" \
  "http://39.101.69.172:11434|deepseek-r1:32b" \
  "http://47.98.189.244:11434|deepseek-r1:32b" \
  "http://8.130.170.41:9099|deepseek-r1:32b" \
  "http://101.200.85.249:11434|deepseek-r1:32b" \
  "http://182.92.129.55:11434|deepseek-r1:70b" \
  "http://20.42.220.26:11434|deepseek-r1:32b" \
  "http://189.155.184.116:11434|deepseek-r1:32b" \
  "http://121.6.50.203:11434|deepseek-r1:14b"; do
  url=$(echo $server | cut -d'|' -f1)
  model=$(echo $server | cut -d'|' -f2)
  echo -n "Testing $url ($model) ... "
  if curl -s --connect-timeout 3 "$url/api/tags" | grep -q "$model"; then
    echo "✅ OK"
  else
    echo "❌ FAIL"
  fi
done
