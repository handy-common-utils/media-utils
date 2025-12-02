#!/bin/bash

DEST_DIR="test/sample-media-files"
mkdir -p "$DEST_DIR"

# List of "filename|url"
FILES=(
  "large_TearsOfSteel.mov|http://blender-mirror.kino3d.org/mango/download.blender.org/demo/movies/ToS/tears_of_steel_1080p.mov"
  "large_TearsOfSteel.mkv|http://blender-mirror.kino3d.org/mango/download.blender.org/demo/movies/ToS/tears_of_steel_1080p.mkv"
  "large_TearsOfSteel.webm|http://media.xiph.org/mango/tears_of_steel_1080p.webm"
  "large_TearsOfSteel.mp4|http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
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
