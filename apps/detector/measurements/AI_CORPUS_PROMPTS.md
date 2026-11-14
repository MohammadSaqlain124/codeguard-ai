# AI class prompt sheet

60 prompts, matched to the task mix of the 97-file human corpus.

## How to use this

One file per prompt. Paste the prompt plus its STYLE line into the model, take
the code, save it as a .py file in `E:\temp\ai`. Do not hand-edit the result -
grades 2 and 3 are derived automatically and editing breaks the comparison.

The STYLE line is not decoration. Models write docstrings and type hints on
nearly everything; the human corpus has module docstrings on 11% of files,
function docstrings on 33%, and type hints on 11%. Without the STYLE lines a
classifier separates the two classes on those markers alone and learns nothing
about authorship. The lines below reproduce the human rates.

Rotate the MODEL column. Fifty files from one model teaches the classifier that
model's fingerprint rather than AI authorship in general. Any four models will
do - swap any you cannot access, and record which you used.

Target length 25 to 600 lines; anything outside that is dropped by the builder.


## computer vision / ML coursework

**1.** Detect and crop licence plates from a car photo using OpenCV, then save each crop.
   - MODEL: ChatGPT
   - STYLE: no docstrings, no type hints, no comments
   - save as: `001.py`

**2.** Train a simple face recogniser from a folder of labelled images using OpenCV LBPH.
   - MODEL: Gemini
   - STYLE: no docstrings, no type hints, no comments
   - save as: `002.py`

**3.** Capture 30 face samples from the webcam and save them numbered under a person's id.
   - MODEL: Copilot
   - STYLE: function docstrings, comments
   - save as: `003.py`

**4.** Classify handwritten digits from a CSV of pixel values using a k-nearest-neighbour you write yourself.
   - MODEL: DeepSeek
   - STYLE: module docstring, function docstrings, type hints, comments
   - save as: `004.py`

**5.** Compare three edge detectors (Sobel, Canny, Laplacian) on one image and save the results side by side.
   - MODEL: ChatGPT
   - STYLE: module docstring, function docstrings, comments
   - save as: `005.py`

**6.** Count moving objects in a video file using background subtraction.
   - MODEL: Gemini
   - STYLE: function docstrings
   - save as: `006.py`

**7.** Read a scanned exam sheet image and detect which bubbles are filled.
   - MODEL: Copilot
   - STYLE: function docstrings, comments
   - save as: `007.py`

**8.** Implement PCA by hand on a small dataset and plot the first two components.
   - MODEL: DeepSeek
   - STYLE: function docstrings, comments
   - save as: `008.py`

**9.** Segment an image into k colour regions using k-means you implement yourself.
   - MODEL: ChatGPT
   - STYLE: comments
   - save as: `009.py`

**10.** Detect the four corners of a document in a photo and warp it flat.
   - MODEL: Gemini
   - STYLE: module docstring, comments
   - save as: `010.py`

**11.** Build a naive Bayes text classifier for spam from a labelled CSV, no sklearn.
   - MODEL: Copilot
   - STYLE: no docstrings, no type hints, no comments
   - save as: `011.py`

**12.** Extract frames from a video every N seconds and save them as JPEGs.
   - MODEL: DeepSeek
   - STYLE: comments
   - save as: `012.py`

**13.** Match a template image inside a larger image and draw a rectangle on the match.
   - MODEL: ChatGPT
   - STYLE: comments
   - save as: `013.py`

**14.** Read a number plate crop and recognise its characters using template matching.
   - MODEL: Gemini
   - STYLE: function docstrings, comments
   - save as: `014.py`

**15.** Plot a confusion matrix for a classifier's predictions from two CSV columns.
   - MODEL: Copilot
   - STYLE: function docstrings, comments
   - save as: `015.py`

**16.** Resize and normalise a folder of images into a single numpy array file.
   - MODEL: DeepSeek
   - STYLE: function docstrings
   - save as: `016.py`

**17.** Detect faces in a group photo and blur each one.
   - MODEL: ChatGPT
   - STYLE: no docstrings, no type hints, no comments
   - save as: `017.py`


## networking, bots and scraping

**18.** Write a TCP chat server that accepts multiple clients using threads.
   - MODEL: Gemini
   - STYLE: no docstrings, no type hints, no comments
   - save as: `018.py`

**19.** Write the matching TCP chat client with a simple console interface.
   - MODEL: Copilot
   - STYLE: comments
   - save as: `019.py`

**20.** Scrape product name and price from a shopping page and write them to CSV.
   - MODEL: DeepSeek
   - STYLE: comments
   - save as: `020.py`

**21.** Build a Telegram-style console bot that answers from a dictionary of canned replies.
   - MODEL: ChatGPT
   - STYLE: module docstring
   - save as: `021.py`

**22.** Fetch a weather API by city name and print a formatted forecast.
   - MODEL: Gemini
   - STYLE: no docstrings, no type hints, no comments
   - save as: `022.py`

**23.** Write a link crawler that follows links two levels deep from a start URL.
   - MODEL: Copilot
   - STYLE: no docstrings, no type hints, no comments
   - save as: `023.py`

**24.** Make a file transfer server and client over sockets.
   - MODEL: DeepSeek
   - STYLE: function docstrings, comments
   - save as: `024.py`

**25.** Log in to a site with requests and a session, then download a page behind the login.
   - MODEL: ChatGPT
   - STYLE: comments
   - save as: `025.py`

**26.** Build a voice assistant that takes a spoken command and opens a website.
   - MODEL: Gemini
   - STYLE: module docstring, type hints
   - save as: `026.py`

**27.** Poll an RSS feed every few minutes and print new items.
   - MODEL: Copilot
   - STYLE: function docstrings, comments
   - save as: `027.py`

**28.** Scrape a table from a Wikipedia page into a pandas DataFrame and save it.
   - MODEL: DeepSeek
   - STYLE: function docstrings, comments
   - save as: `028.py`

**29.** Write a UDP client and server that measure round-trip time.
   - MODEL: ChatGPT
   - STYLE: no docstrings, no type hints, no comments
   - save as: `029.py`

**30.** Build a port scanner that checks a range of ports on a host.
   - MODEL: Gemini
   - STYLE: no docstrings, no type hints, no comments
   - save as: `030.py`

**31.** Download all images from a web page into a folder.
   - MODEL: Copilot
   - STYLE: no docstrings, no type hints, no comments
   - save as: `031.py`


## misc tools (editors, calculators, converters)

**32.** Build a tkinter calculator with buttons for the four basic operations.
   - MODEL: DeepSeek
   - STYLE: comments
   - save as: `032.py`

**33.** Build a simple tkinter text editor with open, save and save-as.
   - MODEL: ChatGPT
   - STYLE: function docstrings
   - save as: `033.py`

**34.** Build a tkinter paint app where the mouse draws lines in a chosen colour.
   - MODEL: Gemini
   - STYLE: no docstrings, no type hints, no comments
   - save as: `034.py`

**35.** Convert a number between binary, octal, decimal and hex from the console.
   - MODEL: Copilot
   - STYLE: function docstrings, comments
   - save as: `035.py`

**36.** Encrypt and decrypt a message with a Caesar cipher, console driven.
   - MODEL: DeepSeek
   - STYLE: function docstrings, comments
   - save as: `036.py`

**37.** Build a unit converter for length, weight and temperature with a tkinter form.
   - MODEL: ChatGPT
   - STYLE: function docstrings, type hints, comments
   - save as: `037.py`

**38.** Write a command-line to-do list that stores items in a text file.
   - MODEL: Gemini
   - STYLE: function docstrings, type hints, comments
   - save as: `038.py`

**39.** Build a tkinter digital clock and stopwatch in one window.
   - MODEL: Copilot
   - STYLE: no docstrings, no type hints, no comments
   - save as: `039.py`

**40.** Make a password generator with options for length and character classes.
   - MODEL: DeepSeek
   - STYLE: no docstrings, no type hints, no comments
   - save as: `040.py`

**41.** Write a CSV to JSON converter that handles nested column names.
   - MODEL: ChatGPT
   - STYLE: type hints, comments
   - save as: `041.py`

**42.** Build a tkinter colour picker that shows the hex value of the chosen colour.
   - MODEL: Gemini
   - STYLE: module docstring
   - save as: `042.py`

**43.** Write a file organiser that sorts a folder's files into subfolders by extension.
   - MODEL: Copilot
   - STYLE: no docstrings, no type hints, no comments
   - save as: `043.py`


## CRUD / management systems (GUI + DB)

**44.** Build a student management system with tkinter and sqlite3: add, view, update, delete.
   - MODEL: DeepSeek
   - STYLE: comments
   - save as: `044.py`

**45.** Build an employee record system with tkinter forms backed by sqlite3.
   - MODEL: ChatGPT
   - STYLE: no docstrings, no type hints, no comments
   - save as: `045.py`

**46.** Build a contact book with search, stored in sqlite3, console driven.
   - MODEL: Gemini
   - STYLE: comments
   - save as: `046.py`

**47.** Build a library book issue and return system with sqlite3.
   - MODEL: Copilot
   - STYLE: comments
   - save as: `047.py`

**48.** Build a billing system that adds items, computes totals with tax, and prints an invoice.
   - MODEL: DeepSeek
   - STYLE: no docstrings, no type hints, no comments
   - save as: `048.py`

**49.** Build a hotel room booking system with check-in and check-out dates in sqlite3.
   - MODEL: ChatGPT
   - STYLE: comments
   - save as: `049.py`

**50.** Build an attendance register that marks students present by roll number.
   - MODEL: Gemini
   - STYLE: no docstrings, no type hints, no comments
   - save as: `050.py`

**51.** Build a simple bank account system with deposit, withdraw and statement.
   - MODEL: Copilot
   - STYLE: function docstrings
   - save as: `051.py`

**52.** Build an inventory tracker that warns when stock falls below a threshold.
   - MODEL: DeepSeek
   - STYLE: function docstrings
   - save as: `052.py`


## games and interactive toys

**53.** Write the snake game with pygame.
   - MODEL: ChatGPT
   - STYLE: module docstring
   - save as: `053.py`

**54.** Write console tic-tac-toe with a simple computer opponent.
   - MODEL: Gemini
   - STYLE: no docstrings, no type hints, no comments
   - save as: `054.py`

**55.** Write a quiz game that reads questions from a file and keeps score.
   - MODEL: Copilot
   - STYLE: comments
   - save as: `055.py`

**56.** Write a card game that deals hands and compares them by rank.
   - MODEL: DeepSeek
   - STYLE: function docstrings
   - save as: `056.py`


## algorithms and small utilities

**57.** Implement Dijkstra's shortest path on a graph read from a text file.
   - MODEL: ChatGPT
   - STYLE: comments
   - save as: `057.py`

**58.** Implement a binary heap priority queue class and test it.
   - MODEL: Gemini
   - STYLE: type hints
   - save as: `058.py`

**59.** Implement merge sort and quicksort and compare their timings.
   - MODEL: Copilot
   - STYLE: no docstrings, no type hints, no comments
   - save as: `059.py`

**60.** Parse a timetable text file into datetime objects and print the week's schedule.
   - MODEL: DeepSeek
   - STYLE: type hints, comments
   - save as: `060.py`
