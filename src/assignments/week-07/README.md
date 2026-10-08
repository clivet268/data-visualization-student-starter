# Reference: https://fe.globalanceworld.com/sevMdamhipFhrjejG/climate

I could not find a source for it, I think its closed source but I used wget to download the whole website and its sources.
I ended up not using the source from reference and just describing the website to claude and it was able to pull together many resources such as the api used to get the geojson outlines of the countries from the threejs examples at
https://cdn.jsdelivr.net/npm/three-globe/example/country-polygons/ne_110m_admin_0_countries.geojson


I did not add every single aspect of the website because it goes into other views than the main page and most of the d3 relevant stuff was on the main page.
If youre looking to focus on the d3 stuff the popup window is where its at, click a country and then go throught the indexes annd the metrics.

I definitely took some creative liberties just to add my own little spin to it (in prompting, and in the names of the companies), but I feel it is similiar in presentation style to the original for the most part.

This was the most ive used AI since the instructions seemed to be directly focused on it, and it was an interesting experience.




## My takeaways from this as the first AI gen project Ive prompted:
Claude is many times better than gemini, at least the way I was using gemini. 
It is much less error prone, more thorough, and can handle more complexity. Its much easier to prompt.

I still learned a couple things, as I'm not super familliar with js, and will be able to look at this as an example in the future when I want to know what would be a clean way to do something,
but it was definitely a more abstract view and much of this code would have taken me days to achieve. I didn't grind through it so I don't think I could do much manually

I still enjoy manually writing and reviewing code but it seems that for many tasks the AI can write a good enough or optimal structure.
For this assignment I found the basic functionality to just work, there wasnt really anything that needed review to get this little example to work as intended.

It is something I will need to think hard about, its was eye opening but does shake my world as a coder (has been since its gotten good) 

Scary in many ways, but I can work with it.

You will not find my signature in here.



## Prompts used:

(I prompted gemini to make a simple globe with threejs and put a regtangel using geojson coords)
and then...

### Claude Prompts:

===================================================================================================
add it so there is a polygon you can drag the corners around on the globe
===================================================================================================
add another set of 3 fixed areas
===================================================================================================
make it so that:
you can add a dot with a button in the top left

you can click and type in coords into the existing coord list in the top left

make each fixed area have a number associated with it and display a total of all the areas enclosed within the white dots then display that total in the top right
===================================================================================================
scratch the draggable polygon idea, i want polygons outlining every country
===================================================================================================
make each country outline have a solid fill and rather than using a globe image as the background just make it a solid off white color.

fetch the countries url then put the data into an object that allows a country to be linked to a set of data, for now within those data objects have it store a list of tuples with string key number value, have them be random numbers from 0.1 to 10.1 and the keys be indexa_warming indexb_warming indexc_warming and s on to up to g

then change the fill color of the countries pologons to be from blueish white at 0 to blue at 3 to orange at 4 to red at 5 to a deep dark red at 10
===================================================================================================
for the countries data, rather than 1 random value per key make it 
make it so that each country can be clicked and when clicked a d3 based window will slide up, this window can be folded up and down while the context remains when folded down

The window has a set of d3 graphs that display
===================================================================================================
scratch that last statement

make it so that each country can be clicked and when clicked a d3 based window will slide up, this window can be folded up and down while the context remains when folded down


The window has a set of d3 graphs that display the countries shapes flattend along a line and shrunk down so that they all fit snugly within a 1:1 ratio area of about 20-100 px, snugle in that one dimension, x or y touches both the top and bottom and the other dimension also does or is within it

these countries are organized on a line sorted from low to high for the current indexes value for that country, the clicked on country on the map has a line up with a tooltip that lists all its indexes values sorted high to low and current index bolded

the current index of focus con be switched between with a little dialogue with arrows to go left and right between them in the top left 

this slide up window is rounded and scrollable and there is filler text above and below the comparison graph
===================================================================================================
clicking countries does not bring up the window showing the comparison graphs, i wan the globe to also zoom in on the center of the country and stop spinning. the globe should also stop spinning when the mouse is dragging the globe around
===================================================================================================
when dragging around the point on the earth should follow the mouse no matter the zoom, right now its too fast when zoomed out and much much too fast when zoomed in

make the pop up window about 30% shorter 

instead of individual numbers per index have a set of 50 random numbers 

the distribution of centers of random values should be a double bell curve around 2 and 8

then in place of these values use the average of each index to place them on their graphs 
rather than having a scroll bar have a fixed with bar, the width of the element as it is is good, and have an x axis go from 10 degrees celsius to 0 on the right , have the countries outlines centered on this, make them semi transparrent and keep the tooltip over the one focused to on the map as well as make it have a higher opacity than the others

when mousing over another country on this bar axis have the one moused over also have a higher opacity
===================================================================================================
above the first sample text in the window put the average of ALL VALUES in the current indexes, that is for each country take its set of values in the current index, put it into the cumulative list (we'll call it the portfolio list ) and then average that put that value in large text and in its color matching the gradiant that the countries do according to their value

then next to this value have 3 bars with the one on the left being the percent of the portfolio list that is from 4-10 degrees celcius, fill that bar with the red color that percent the rest grey and then put the text showing the percent above that 

do the same for 2 to 4 celsius and 0 to 2

the widths of those 4 element should be relatively 5|8|8|8

also going back to the bar, have the moused over country also grow in size and have a white outline to make it stand outon the other countires, make the bias of the two normal distributions be the one around 8 degrees is 30% that of the 2 degress
===================================================================================================
for the colors on the 3 bars it should be that the highest value one has red, the middle one has orange and the smalles has baby blue 

for the numbers now rather than having a gradient have fixed colors that go from their color with some white when close to the bottom of the range to that color solid at the top the range those ranges are baby blue(this is the exception have it be solid at the bottom and lighter at the top) at 0 to 2 creamsicle orange from 3 to 4 orange orange from 4 to 5 red orange from 5 to 7 then dark red from 7 to 10

for the pop up window make it wider but keep the content the same, when scrolling up on it rather than scrolling within it make the window scroll till it hits the top of the page then make the whole page scroll, make the canvas and page background be light grey and the earth be soemthing like #ddd or #eee
===================================================================================================
(I ran out of free tokens, pasted the whole code in a new instance)
===================================================================================================
for the colors on the 3 bars it should be that the highest value one has red, the middle one has orange and the smalles has baby blue
for the numbers now rather than having a gradient have fixed colors that go from their color with some white when close to the bottom of the range to that color solid at the top the range those ranges are baby blue(this is the exception have it be solid at the bottom and lighter at the top) at 0 to 2 creamsicle orange from 3 to 4 orange orange from 4 to 5 red orange from 5 to 7 then dark red from 7 to 10
for the pop up window make it wider but keep the content the same, when scrolling up on it rather than scrolling within it make the window scroll till it hits the top of the page then make the whole page scroll, make the canvas and page background be light grey and the earth be soemthing like #ddd or #eee
===================================================================================================
apply the changes directly to the doc and give me the updated file to download (because it was a new instance I had to get it back to the same direct editing style)
===================================================================================================make all the colors more vibrant and the max amount of white added less

add 3 more paragraphs of lorum in the pop up window

make it so that each country has a dot floating above its center with a white outline around its country's corresponding color and and when hovering over a country show a tooltip with the country name, text saying top contributers and then from its dataset for the currently selected index have it select the top 4 companies by value and then give them a name so like  

France
Top contributers:
{company name placeholder} : 9.2
{company name placeholder} : 9.1
{company name placeholder} : 9.0
{company name placeholder} : 9.0
===================================================================================================
make all the colors more vibrant and the max amount of white added less
add 3 more paragraphs of lorum in the pop up window
===================================================================================================
for each company in an index rather than having just 1 number each should have 4 so youll end up having a list of countries each with a list of indexes each with a list of companies each with a list of 4 metrics, dont touch the names list here except to optionally add to it

then now that you can flip through the indexes you can also go through the metrics have the metrics be 4 circles with their names next to it on the right of the main screen top to bottom being red green purple blue, have each circle have a gradient that is just barely lighter at the top of the circle than bottom
===================================================================================================
sorry make the metrics selector on the left side and make it so when youer looking at the green metric the numbers are on a scale from very light green to full green (the color of the circle), for the purple metric do it from light purple to the cirlce color purple and for the blue do red at 0 to light red at 5 then above 5 do light blue to the circle color blue
===================================================================================================
when in the pop up window place these above the last three paragraphs of lorum

metric a have a prediction chart with a red orange high range and blue low range based on the values as starting points then have the high range be mostle flat slight curved down and the bottom one be slightly curved down

make metric b's data be a list of 7 numbers from 0 to 10 and when in metric b's tab instead of the country shape have a rounded spline with the distance from the center being the corresponding value and make them all go around in a circle have one third at the top be labled economy and have 3 values, the bottom left third be environment and have 3 values and the bottom right third have 1 value 

make metric c's data be a list with ALL companies names and their metric with a bar thats grey and gets filled with purple ont he scale 1-10 and then the that value for it

make metric d's data be a list for 60 data points ranging smoothly from a random starting point 0.1 to 10.1 using a function with either 3,4 or 5 terms and then for each point apply some random offset put these on a chart from 0 to 10.1 y axis x axis month names from january to december only put the data to end of october after that leave it blank, if its below 5 make the line red above make it blue, within 1 of 5 make it gray 
underneath put a bar chart showing these same values with below 5 being negative and above 5 positive make this bar chart very short


For all metrics
then down below the last lorum in the pop up window make a comparison chart between all indexesaverage metric x
===================================================================================================
add a titlebar to the webpage that is lighter than the background, add a company logo slot top left that says Thanks Globalance World, a select tab that has an entry named portfolio and another titled source that links to https://fe.globalanceworld.com/sevMdamhipFhrjejG/climate 

top right in this title bar add a button that say sign in and when clicked pops up a little tooltip text that says no need then the tooltip goes away
===================================================================================================
(done)