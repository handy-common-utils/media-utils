#!/bin/bash

DEST_DIR="test/sample-media-files"
mkdir -p "$DEST_DIR"

# List of "filename|url"
FILES=(
  "large_TearsOfSteel.mov|https://download.blender.org/demo/movies/ToS/tears_of_steel_1080p.mov.zip"
  "large_TearsOfSteel.webm|https://download.blender.org/demo/movies/ToS/tears_of_steel_1080p.webm.zip"
  "large_BigBuckBunny.mp4|https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4.zip"
  "large_BigBuckBunny_surround.avi|https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_720p_surround.avi.zip"
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
      # Check if the URL ends with .zip (case-insensitive)
      if [[ "$url" =~ \.[Zz][Ii][Pp]$ ]]; then
        
        # Define a temporary location for the ZIP archive
        TEMP_ZIP=$(mktemp "$DEST_DIR/XXXXXX.zip")
        
        # Download to the temporary location
        curl -s -L -o "$TEMP_ZIP" "$url"
        
        if [ -f "$TEMP_ZIP" ]; then
          echo "Downloaded for $filename to temporary ZIP archive $TEMP_ZIP"
          
          # Get the name of the first/only file inside the ZIP (ignores directories)
          # -Z -1 lists only the raw filenames inside the archive
          INTERNAL_NAME=$(unzip -Z -1 "$TEMP_ZIP" | grep -v '/$' | head -n 1)
          
          if [ -z "$INTERNAL_NAME" ]; then
            echo "Error: ZIP file is empty or invalid"
            rm -f "$TEMP_ZIP"
            exit 1
          fi

          # Strip any directory path from the internal name to know its base filename
          BASE_INTERNAL_NAME=$(basename "$INTERNAL_NAME")

          # Extract the file directly into DEST_DIR, discarding any internal archive folder structures (-j)
          unzip -q -j "$TEMP_ZIP" "$INTERNAL_NAME" -d "$DEST_DIR"
          
          # Rename the extracted file to your specific $filename
          mv "$DEST_DIR/$BASE_INTERNAL_NAME" "$DEST_DIR/$filename"
          
          # Clean up the temporary ZIP archive
          rm -f "$TEMP_ZIP"
          
          echo "Extracted and renamed file to $DEST_DIR/$filename"
        else
          echo "Error: Failed to download ZIP from $url"
          exit 1
        fi

      else
        # Standard download behavior for non-zip files
        curl -s -L -o "$DEST_DIR/$filename" "$url"
        
        if [ -f "$DEST_DIR/$filename" ]; then
          echo "Downloaded $filename"
        else
          echo "Error: Failed to download $filename"
          exit 1
        fi
      fi
    ) &
    pids="$pids $!"
  done

  # Wait for all background jobs
  for pid in $pids; do
    wait $pid || (( missing_files++ ))
  done

  if (( missing_files > 0 )); then
    echo "Failed to download $missing_files files."
    exit 1
  fi
else
  echo "All sample media files exist. Skipping download."
fi
