from PIL import Image, ImageOps

img = Image.open("frontend/public/favicon.png").convert("RGBA")
# Make it white: replace non-transparent pixels with white
data = img.getdata()
newData = []
for item in data:
    if item[3] > 0: # if not fully transparent
        newData.append((255, 255, 255, item[3]))
    else:
        newData.append((255, 255, 255, 0))
img.putdata(newData)

# Make it square (pad with transparent)
width, height = img.size
max_dim = max(width, height)
new_img = Image.new('RGBA', (max_dim, max_dim), (255, 255, 255, 0))
new_img.paste(img, ((max_dim - width) // 2, (max_dim - height) // 2))

# Save
new_img.save("frontend/public/favicon.png")
print("Done")
