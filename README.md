# Sonoff / EweLink web interface

## Instructions to run your own
1. Clone this repository
```
git clone https://github.com/ndg63276/sonoff.git
```
2. Run the included server by
```
python serve.py
```
3. Navigate to http://localhost:8000 in your browser

## Known Bugs
1. Sonoff expects an appid and secret, which you will have to get for yourself. Once you have them, insert them into the top of functions.js.
2. A CORS-anywhere server is required to use the Sonoff API, see https://github.com/Rob--W/cors-anywhere for help. Once you have set one up, insert the address at the top of functions.js.

## Website
This tool is freely available (without the bugs) at https://smartathome.co.uk/sonoff/

## SmartAtHome
All the tools from the SmartAtHome website are available at https://github.com/ndg63276/smartathome
