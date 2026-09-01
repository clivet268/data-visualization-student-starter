# "All Earthquakes" 
#### From: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.csv


This is a CSV list of all the seismic events recorded during the month of august 2026 including the below data:
| csv column | longer name | description | data type |
| ---- | ---- | ---- | ---- |
| time | Time | Timestamp of event | Timestamp |
| latitude,longitude,depth | Lattitude/Longitude/Depth | Location of event epicenter lat+lon in Decimal Degrees and depth in km | Lat/Long,Lat/Long,Quantitative |
| mag,magType | Magnitude,Magnitude Scale | The Magnitude Scale tell you the abreviation of the scale and then Magnitude tells you the level on that scale | Quantitative,Categorical |
| nst | Number of Stations | The number of stations that were recording/contributed to this data during the time of this event | Quantitative |
| gap | largest azimuthal gap | The Largest clockwise gap measuring from a station and rotating to all of the others, in degrees *(1) | Quantitative |
| dmin | minimum distance | Distance from the epicenter to the nearest station in Decimal Degrees (like latitudal and longitudal degrees) | Quantitative |
| rms | root mean square | The root mean square travel time residual in seconds, weighted *(2) It shows the difference between the estimations of when the waves will arrive and when they acctually did, showing the accuracy of the model. Measurement stations are given weights depending on the measurement system used but distance to the epicenter is a large factor. *(3) | Time Interval |
| net | network ID | The network ID of the data's contributor *(4) | Categorical |
| id | event ID | The unique ID of this seismic event | Categorical |
| updated | last updated timestamp | The time the seismic event was last updated | Timestamp |
| place | Place near event | A string detailing a landmark or city and then a distance and direction relative to that place | Other Space Descriptor |
| type | the type of seismic event | Most of these are earthquakes but a few hundred in this set are from other sources such as explosions, quarrying blasts, landslides and icequakes *(5) | Categorical |
| horizontalError,depthError,magError | The uncertainties of these values, horizontal and depth in km from event location and mag in the scale units mentioned in magType | Quantitative,Quantitative,Quantitative |
| magNst | Magnitude number of stations | number of stations used for magnitude calculation | Quantitative |
| status | Review status | Whether this seismic event was reviewed by a person or has only been automatically reported | Categorical |
| locationSource | Network that authored the report of the location calculation | Categorical |
| magSource | Network that authored the report of the magnitude calculation | Categorical |

#### References:

Explains very briefly these values meaning and was the primary source: https://datascienceplus.com/earthquake-analysis-1-4-quantitative-variables-exploratory-analysis/

* (1) Figure explaining what azimuthal means: https://www.researchgate.net/figure/Azimuthal-gap-An-earthquake-epicenter-is-denoted-by-star-seismic-stations-by-triangles_fig15_284086572
* (2) Root mean square explanation: https://assets.pnsn.org/notable/glossary.html
* (3) Explaining how weighting is done in this context: https://gfzpublic.gfz.de/rest/items/item_4109_4/component/file_4110/content
* (4) List of network id codes: http://ds.iris.edu/mda/
* (5) Full list of seismic events that could appear in the usgs earthquake datasets: https://earthquake.usgs.gov/earthquakes/search/ 