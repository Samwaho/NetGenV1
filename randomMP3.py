import os
import shutil
import random
import time

# === SETTINGS ===

source_folder = r'E:\New folder'   # Path to your MP3 folder
usb_folder = r'F:\\'                  # Path to your USB drive folder

# =================

# Get list of all mp3 files
mp3_files = [f for f in os.listdir(source_folder) if f.lower().endswith('.mp3')]

# Shuffle the list of files
random.shuffle(mp3_files)

# Create the destination folder on USB if it doesn't exist
os.makedirs(usb_folder, exist_ok=True)

# Optionally, clear out the USB folder (if needed)
for file in os.listdir(usb_folder):
    if file.lower().endswith('.mp3'):
        os.remove(os.path.join(usb_folder, file))

# Now we will randomly copy the MP3s to the USB in the shuffled order
# This will create a more randomized "write" process

# Shuffle the MP3 file order *again* for a deeper random effect
random.shuffle(mp3_files)

# Perform the copying with a small random delay between files
for filename in mp3_files:
    src_path = os.path.join(source_folder, filename)
    dst_path = os.path.join(usb_folder, filename)
    
    # Simulate a random delay (to further disturb any file-copying order)
    time.sleep(random.uniform(0.1, 0.5))  # Random delay between 0.1 and 0.5 seconds

    shutil.copy2(src_path, dst_path)  # Copy with metadata preservation
    print(f"Copied: {filename}")

print("\n✅ All files copied to USB in a maximally random order!")
