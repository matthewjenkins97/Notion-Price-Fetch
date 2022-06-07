const { Client } = require('@notionhq/client');
const notion = new Client({ auth: "secret_FbBjMys8uZ60lMt6xpoK2jitA52Pm7RkqJmM0zmKVgA" });
const fetch = require("node-fetch");
const geoip = require("geoip-lite");
const extIp = require('ext-ip')();

/*
client_id: notionpricefetcher-00faff82284a73e8abb5823239053252961371863289060822
client_secret: OKM70GqyctVxznFkaPI7XcnnQjv7uIuzkfTHYUos

curl -X POST \
  'https://api.kroger.com/v1/connect/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Authorization: Basic {{base64(CLIENT_ID:CLIENT_SECRET)}}' \
  -d 'grant_type=client_credentials'
*/

async function getIngredients() {
    let cursor = undefined;
    let databaseInfo = undefined;
    let ingredientsList = [];
    do {
        databaseInfo = await notion.databases.query({ database_id: "3329d7d4d9194e3aaffb1f472a955445", start_cursor: cursor})
        cursor = databaseInfo.next_cursor;
        ingredientsList.push(databaseInfo.results);
    } while (databaseInfo.has_more);
    ingredientsList = ingredientsList.flat();
    return ingredientsList;
}

async function main() {
    let ingredients = await getIngredients();

    // kroger api fuckery
    const key = Buffer.from("notionpricefetcher-00faff82284a73e8abb5823239053252961371863289060822:OKM70GqyctVxznFkaPI7XcnnQjv7uIuzkfTHYUos").toString('base64')
    let accessToken = await fetch("https://api.kroger.com/v1/connect/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${key}`
        },
        body: new URLSearchParams({
            "grant_type": "client_credentials",
            "scope": "product.compact",
        })
    });
    accessToken = await accessToken.json();
    let locationParam = new URLSearchParams({
        "filter.zipCode.near": 43004,
        "filter.radiusInMiles": 100
    });
    let locations = await fetch(`https://api.kroger.com/v1/locations?${locationParam}`, {
        method: "GET",
        cache: "no-cache",
        headers: {
            "Authorization": `Bearer ${accessToken.access_token}`
        }
    });
    locations = await locations.json();

    console.log("Ingredient,Item name in Kroger database,Price")
    for (let ingredient of ingredients) {
        let searchParam = new URLSearchParams({
            "filter.term": ingredient.properties.Name.title[0].plain_text,
            "filter.locationId": locations.data[0].locationId
        });
        let search = await fetch(`https://api.kroger.com/v1/products?${searchParam}`, {
            method: "GET",
            cache: "no-cache",
            headers: {
                "Authorization": `Bearer ${accessToken.access_token}`
            }
        });
        search = await search.json();
        if (search.data[0] === undefined) {
            console.log(ingredient.properties.Name.title[0].plain_text,",Not found,unknown");
        } else {
            console.log(ingredient.properties.Name.title[0].plain_text,",",search.data[0].description,",",search.data[0].items[0].price)
        }
    }

}

main()
