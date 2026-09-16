# Pollution event and status interactive map

- 1. Pollution present in an area and its sources, likely light, water, sound, air or food contamination
- 2. How many people are affected by this? What are the sources? What mitigations are/are in progress of being implemented?
- 3. https://storage.googleapis.com/petrochemical_risk_map_public/petrochemical_air_pollution_map_download.zip
     https://gaftp.epa.gov/storet/exports/?C=M;O=A
     https://www.who.int/publications/m/item/who-ambient-air-quality-database-(update-jan-2024)
     https://airs.jpl.nasa.gov/api/v1/publications.csv
     https://gemstat.org/ (https://zenodo.org/records/18459694)

- 4. https://experience.arcgis.com/experience/12412ab41b3141598e0bb48523a7c940/page/Page-1?views=Known-Contamination
     https://www.airnow.gov/
     https://projects.propublica.org/toxmap/
     https://www.clearcollab.org/pollution-map-app/
     https://www.lightpollutionmap.info/

- 5. My idea is an interactive map with multiple dashboards in it depending on the event/location. Inspired by the multiple mapping programs linked and liveuamap too kinda. It connects the data accross time for each event and builds in outside sources into it to show the timeline of events and events as reported. Including links to information and calls to action per location will also increase the effectiveness of this project in informing and activating people within their communities.
     Another thing that I hope will be helpful is breaking it down so someone whos clicking around they get a complete brief look and then when they find a location theyre interested in or researching they can get all the information needed in a way thats not overwhelming. I may need to scale up the graphs more in the real detailed view and I play to include multiple templates since different events may need more or fewer graphs to express the data.

<img width="4032" height="2857" alt="PXL_20260903_010629166" src="https://github.com/user-attachments/assets/7f08d567-4edf-4576-92b7-f660f15bec7b" />
<img width="4032" height="3024" alt="PXL_20260903_010612133" src="https://github.com/user-attachments/assets/306473a3-a6a8-4dc9-ac88-9ff35a96c133" />

Task Analysis

For the different audiences outlined above there are basically two targeted use cases:

The guided users (students, researchers, people preparing a site job) are

- Analyzing the trends of one or more target areas or events to estimate long term impacts/solutions. Being able to determine the similarity/dissimilarity across event types (cleanup approach A vs cleanup approach B) and link that to the event outcomes (an increase in daily affected people vs a drop in daily affected people).

The unguided users (curious members of a community, students) are

- Discovering these events and exploring through them for local events and outliers they may find interesting.

Validation 

Domain level:

     - Interview target guided users on usefullness, see reactions and extend of use by unguided users (anecdotal)

Abstraction level:

     - See that the most relevant metrics avg people care about are presented first in the quick look at an incident (the ideal unguided user walks away either satisfied or begins a guided path) (the ideal guided user is able to get all graphics filtered and neat for the main graphics and is able to access all available data in some form, fills their research needs or successfully links to where it can be found for things like statements) (anecdotal)

Idiom level:

     - See that the ideal user (both kinds) is engaged by and not overwhelmed by the multi panel and deep dive screen. See that the ideal user (both kinds) able to navigate the map and find event(s) they want. See that graphs are presented accurately and can handle all edge cases in provided dataset with almost no human review (in terms of data structure) (anecdotal, qualitative)

Algorithms level: 

     - Consider network impacts of sending entire global dataset, send only whats visible and measure how much data is sent
     - Consider mem and render times, Largest Contentful Paint (LCP), Interaction to Next Paint (INP) are good metrics, too high is choppy but for large numbers of points there will need to be compromise (quantitative)

