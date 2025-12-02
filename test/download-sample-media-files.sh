#!/bin/bash

DEST_DIR="test/sample-media-files"
mkdir -p "$DEST_DIR"

# List of "filename|url"
FILES=(
  "large_TearsOfSteel.mov|https://mirrors.dotsrc.org/blender/blender-demo/movies/ToS/tears_of_steel_1080p.mov"
  "large_TearsOfSteel.webm|http://media.xiph.org/mango/tears_of_steel_1080p.webm"
  "large_TearsOfSteel.mp4|http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
  "large_BigBuckBunny_surround.avi|https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_720p_surround.avi"
  "large_matroska-test-files1.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test1.mkv"
  "large_matroska-test-files2.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test2.mkv"
  "large_matroska-test-files3.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test3.mkv"
  "large_matroska-test-files4.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test4.mkv"
  "large_matroska-test-files5.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test5.mkv"
  "large_matroska-test-files6.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test6.mkv"
  "large_matroska-test-files7.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test7.mkv"
  "large_matroska-test-files8.mkv|https://github.com/ietf-wg-cellar/matroska-test-files/raw/refs/heads/master/test_files/test8.mkv"
)

files_to_download=()
display_names=""

for item in "${FILES[@]}"; do
  filename="${item%%|*}"
  if [ ! -f "$DEST_DIR/$filename" ]; then
    files_to_download+=("$item")
    if [ -z "$display_names" ]; then
      display_names="$filename"
    else
      display_names="$display_names, $filename"
    fi
  fi
done

if [ ${#files_to_download[@]} -gt 0 ]; then
  echo "Start downloading $display_names..."
  
  missing_files=0
  pids=""
  for item in "${files_to_download[@]}"; do
    filename="${item%%|*}"
    url="${item#*|}"
    
    # Run in background
    (
      curl -s -L -o "$DEST_DIR/$filename" "$url"
      if [ -f "$DEST_DIR/$filename" ]; then
        echo "Downloaded $filename"
      else
        # No error from curl but the file is not there
        echo "Error: Failed to download $filename"
        (( missing_files++ ))
      fi
    ) &
    pids="$pids $!"
    if (( $! > 0 )); then
      # Error from curl
      (( missing_files++ ))
    fi
  done

  # Wait for all background jobs
  for pid in $pids; do
    wait $pid
  done

  if (( missing_files > 0 )); then
    echo "Failed to download $missing_files files."
    exit 1
  fi
else
  echo "All sample media files exist. Skipping download."
fi
