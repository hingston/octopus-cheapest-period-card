# Lovelace custom card for Octopus Energy Cheapest Period

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

This lovelace card calculates and displays the cheapest upcoming period of a user-defined duration based on the electricity rates provided by the [BottlecapDave/HomeAssistant-OctopusEnergy](https://github.com/BottlecapDave/) integration. It also shows how long until that cheapest period begins.

This is particularly useful for planning when to run appliances like dishwashers, washing machines, or charge electric vehicles to minimize costs on tariffs like Octopus Agile.

#### Features

*   Finds the cheapest period of a specified duration (in hours, in 30-minute increments).
*   Calculates and displays the average price over the cheapest period.
*   **Displays the time remaining until the start of the cheapest period (e.g., "Starts in X hours Y minutes" or "Now").**
*   Optionally allows setting a maximum acceptable price per kWh; if no period is found below this price, a message is displayed.
*   Indicates the exact start time to begin your appliance usage.
*   Supports configuring units (e.g., p/kWh or GBP/kWh) and multipliers.
*   Basic color coding of the result based on price thresholds (similar to the standard rates card).
*   Dynamic message for when no suitable period is found, using configurable placeholders.

#### Installation
##### HACS
The easiest way to install it is via [HACS (Home Assistant Community Store)](https://github.com/hacs/frontend).

Simply click this button to go directly to the details page:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=hingston&repository=octopus-cheapest-period-card&category=plugin)

In the Home Assistant UI:
1.  Go to HACS.
2.  Click on `Frontend`.
3.  Click the three dots in the top right corner and select `Custom repositories`.
4.  Enter the repository URL: `hingston/octopus-cheapest-period-card`.
5.  Select the category "Lovelace" and click the `Add` button.
6.  Close the custom repositories dialog.
7.  Go to `Explore & Download Repositories` and search for "octopus cheapest". You should find "Octopus Cheapest Period Card".
8.  Click on the card, then click `Download` in the bottom right.
9.  Restart Home Assistant when prompted.

This should automatically configure all the resources, so you can now skip to **Configuration**.

##### Manually
You can also install manually by:
1.  Downloading the `octopus-cheapest-period-card.js` file from the latest release in the GitHub repository.
2.  Placing the downloaded file in the `$homeassistant_config_dir/www/community/` directory on your Home Assistant system.
3.  Adding the Javascript file to Lovelace resources: Go to `Settings` -> `Dashboards` -> Click the three dots in the top right corner -> `Resources`. Click `+ Add Resource`, enter the URL `/community/octopus-cheapest-period-card.js`, select `Javascript Module` as the type, and click `Create`.
4.  Restart Home Assistant.

#### Configuration
Add the card to your dashboard using **Add Card -> Custom: Octopus Cheapest Period Card**.

You will then need to configure the YAML for the card.

The following configuration keys are **required**:

| Name         | Type   | Description                                                                                           |
|--------------|--------|-------------------------------------------------------------------------------------------------------|
| `type`       | String | `custom:octopus-cheapest-period-card`                                                                 |
| `currentEntity`| String | Entity ID of the `event.octopus_energy_electricity_..._current_day_rates` sensor from the Octopus integration. |
| `futureEntity` | String | Entity ID of the `event.octopus_energy_electricity_..._next_day_rates` sensor from the Octopus integration. |
| `durationHours`| Number | The desired duration of the cheapest period in hours (must be a multiple of 0.5).                 |

The following configuration keys are **optional**:

| Name                   | Type    | Default                      | Description                                                                                                                                                              |
|------------------------|---------|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `title`                | String  | "Cheapest Period"            | The title of the card in the dashboard.                                                                                                                                  |
| `maxPrice`             | Number  | `undefined`                  | Maximum acceptable average price (in `unitstr`). Periods above this price are ignored.                                                                                   |
| `unitstr`              | String  | "p/kWh"                      | The unit string to show after the average rate.                                                                                                                          |
| `multiplier`           | Number  | 100                          | Multiply the raw rate (`value_inc_vat` from the API, usually in GBP) by this value.                                                                                      |
| `roundUnits`           | Number  | 2                            | Controls how many decimal places to round the average price to.                                                                                                          |
| `hour12`               | Boolean | `false`                      | Show times in 12 hour format if `true`, and 24 hour format if `false`.                                                                                                   |
| `lowlimit`             | Number  | 5                            | Price threshold (in `unitstr`) for coloring the result green.                                                                                                            |
| `mediumlimit`          | Number  | 20                           | Price threshold (in `unitstr`) for coloring the result orange.                                                                                                           |
| `highlimit`            | Number  | 30                           | Price threshold (in `unitstr`) for coloring the result red.                                                                                                              |
| `noPeriodMessage`      | String  | "No suitable {{ durationHours }} hour period found{{ maxPrice !== undefined ? ' below {{ maxPrice }}{{ unitstr }}' : '' }}." | Message displayed if no suitable period is found. **Supports dynamic placeholders:** `{{ durationHours }}`, `{{ maxPrice }}` (only if `maxPrice` is set), and `{{ unitstr }}` (only if `maxPrice` is set). |
| `cardRefreshIntervalSeconds` | Number | 60                       | How often the card should refresh its data in seconds.                                                                                                   |


Here's an example YAML configuration for your dashboard:

```yaml
type: custom:octopus-cheapest-period-card
title: Cheapest 3.5 Hour Period
currentEntity: event.octopus_energy_electricity_20l2037469_2700006447850_current_day_rates
futureEntity: event.octopus_energy_electricity_20l2037469_2700006447850_next_day_rates
durationHours: 3.5 # Set this to your desired duration in hours (must be multiple of 0.5)
maxPrice: 25 # Optional: Set a maximum price in pence
unitstr: p/kWh # Unit to display price in
multiplier: 100 # Multiply raw rate (GBP/kWh) by 100 for pence
roundUnits: 2 # Number of decimal places for the average price
noPeriodMessage: "Could not find a {{ durationHours }} hour period under {{ maxPrice }}{{ unitstr }}." # Custom dynamic message
```

Make sure to replace the entity IDs with your actual Octopus Energy electricity event entity IDs.

#### Color Coding

The resulting cheapest period displayed will be colored based on its average price relative to the `lowlimit`, `mediumlimit`, and `highlimit` thresholds you set in the configuration (in `unitstr`).

*   Average price below or equal to 0: Blue (`price-negative`)
*   Average price above `highlimit`: Red (`price-high`)
*   Average price above `mediumlimit` but below or equal to `highlimit`: Orange (`price-medium`)
*   Average price above `lowlimit` but below or equal to `mediumlimit`: Dark Green (`price-low`)
*   Average price below or equal to `lowlimit` (and above 0): Green (`price-low`)

#### Thanks/inspiration
This card was inspired by the excellent [BottlecapDave/HomeAssistant-OctopusEnergy](https://github.com/BottlecapDave/) integration and the [lozzd/octopus-energy-rates-card](https://github.com/lozzd/octopus-energy-rates-card) custom card.
