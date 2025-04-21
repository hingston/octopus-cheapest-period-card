class OctopusCheapestPeriodCard extends HTMLElement {
    set hass(hass) {
        const config = this._config;

        if (!this.content) {
            const card = document.createElement('ha-card');
            card.header = config.title;
            this.content = document.createElement('div');
            this.content.style.padding = '0 16px 16px';

            const style = document.createElement('style');
            style.textContent = `
                .cheapest-period-info {
                    font-size: 1.1em;
                    line-height: 1.5; /* Improve readability */
                }
                .highlight {
                    font-weight: bold;
                }
                .price-low { color: green; }
                .price-medium { color: orange; }
                .price-high { color: red; }
                .price-negative { color: blue; }
                 .no-period { color: orange; } /* Style for the no period message */
                 .period-details {
                     margin-top: 8px; /* Add some space above the details */
                 }
            `;
            card.appendChild(style);
            card.appendChild(this.content);
            this.appendChild(card);
        }

        // Initialise the lastRefreshTimestamp
        if (!this.lastRefreshTimestamp) {
            // Store the timestamp of the last refresh
            this.lastRefreshTimestamp = 0;
        }

        // Check if the interval has passed
        const currentTime = Date.now();
        const cardRefreshIntervalSecondsInMilliseconds = (config.cardRefreshIntervalSeconds || 60) * 1000; // Default to 60 seconds
        if (!(currentTime - this.lastRefreshTimestamp >= cardRefreshIntervalSecondsInMilliseconds)) {
            return;
        }
        this.lastRefreshTimestamp = currentTime;


        const currentRatesEntityId = config.currentEntity;
        const futureRatesEntityId = config.futureEntity;
        const durationHours = parseFloat(config.durationHours);
        const maxPrice = config.maxPrice !== undefined ? parseFloat(config.maxPrice) : undefined;
        const multiplier = parseFloat(config.multiplier) || 1;
        const roundUnits = parseInt(config.roundUnits, 10) || 2;
        const unitstr = config.unitstr || '';
        let noPeriodMessageTemplate = config.noPeriodMessage || `No suitable {{ durationHours }} hour period found{{ maxPrice !== undefined ? ' below {{ maxPrice }}{{ unitstr }}' : '' }}.`;


        // Basic validation for durationHours
        if (isNaN(durationHours) || durationHours <= 0 || durationHours % 0.5 !== 0) {
            this.content.innerHTML = `<div style="color: red;">Invalid durationHours configured. Must be a positive multiple of 0.5.</div>`;
            return;
        }

        const currentRatesState = hass.states[currentRatesEntityId];
        const futureRatesState = hass.states[futureRatesEntityId];

        let allRates = [];

        if (currentRatesState && currentRatesState.attributes && currentRatesState.attributes.rates) {
            // Filter out past rates from current day if any exist and are before now
            const now = new Date();
            const currentRates = currentRatesState.attributes.rates.filter(rate => new Date(rate.end) > now);
            allRates = allRates.concat(currentRates);
        }

        if (futureRatesState && futureRatesState.attributes && futureRatesState.attributes.rates) {
            allRates = allRates.concat(futureRatesState.attributes.rates);
        }

        // Ensure rates are sorted by start time
        allRates.sort((a, b) => new Date(a.start) - new Date(b.start));

        const numSlots = durationHours / 0.5; // Number of 30-minute slots

        // Check if enough data is available for the requested duration
        if (allRates.length < numSlots) {
            // Render the dynamic message even if not enough data
            let finalMessage = noPeriodMessageTemplate.replace('{{ durationHours }}', durationHours);
            if (maxPrice !== undefined) {
                finalMessage = finalMessage.replace('{{ maxPrice }}', maxPrice.toFixed(roundUnits));
                finalMessage = finalMessage.replace('{{ unitstr }}', unitstr);
            } else {
                // Remove the optional part if maxPrice is not defined
                finalMessage = finalMessage.replace(/\{\{ maxPrice !== undefined \? '.*?\{\{ maxPrice \}\}.*?\{\{ unitstr \}\}.*?' : '' \}\}/, '');
            }

            this.content.innerHTML = `<p class="no-period">${finalMessage} (Insufficient data: ${allRates.length * 0.5} hours available)</p>`;
            return;
        }


        let minAveragePrice = Infinity;
        let bestPeriod = null;

        // Iterate through possible start times
        for (let i = 0; i <= allRates.length - numSlots; i++) {
            const potentialStartRate = allRates[i];
            const potentialEndRate = allRates[i + numSlots - 1];
            const now = new Date();

            // Only consider periods that are entirely in the future or start now/in the future
            if (new Date(potentialEndRate.end) < now) {
                continue; // Skip if the entire period is in the past
            }


            let sumOfPrices = 0;
            for (let j = 0; j < numSlots; j++) {
                // Ensure we don't go out of bounds, although the loop condition should prevent this
                if (i + j < allRates.length) {
                    sumOfPrices += allRates[i + j].value_inc_vat;
                } else {
                    console.warn("Octopus Cheapest Period Card: Attempted to access rate out of bounds during calculation.");
                    continue; // Should not happen with correct loop bounds
                }
            }

            const averagePrice = sumOfPrices / numSlots;
            const averagePriceMultiplied = averagePrice * multiplier;

            // Check against maxPrice if it's set
            if (maxPrice !== undefined && averagePriceMultiplied > maxPrice) {
                continue; // Skip this period if its average price is above the max price
            }

            // Check if this is the cheapest valid period found so far
            if (averagePrice < minAveragePrice) {
                minAveragePrice = averagePrice;
                bestPeriod = {
                    start: potentialStartRate.start,
                    end: potentialEndRate.end,
                    averagePrice: averagePriceMultiplied
                };
            }
        }

        let htmlContent = '';
        if (bestPeriod) {
            const start = new Date(bestPeriod.start);
            const end = new Date(bestPeriod.end); // End time of the period

            // Format time and date using user's locale
            const lang = navigator.language || navigator.languages[0];
            const timeOptions = {
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: config.hour12 === false ? 'h23' : 'h12'
            };
            const dateOptions = {weekday: 'short', month: 'short', day: 'numeric'};


            const startTimeFormatted = start.toLocaleTimeString(lang, timeOptions);
            const endTimeFormatted = end.toLocaleTimeString(lang, timeOptions);
            const startDateFormatted = start.toLocaleDateString(lang, dateOptions);
            // Only show end date if it's different from the start date
            const endDateFormatted = start.toDateString() === end.toDateString() ? '' : end.toLocaleDateString(lang, dateOptions) + ', ';


            // Determine color based on average price (using original card's logic roughly)
            let priceColorClass = '';
            const lowlimit = config.lowlimit !== undefined ? parseFloat(config.lowlimit) * multiplier : undefined;
            const mediumlimit = config.mediumlimit !== undefined ? parseFloat(config.mediumlimit) * multiplier : undefined;
            const highlimit = config.highlimit !== undefined ? parseFloat(config.highlimit) * multiplier : undefined;


            if (bestPeriod.averagePrice <= 0) {
                priceColorClass = 'price-negative'; // Blue for negative
            } else if (highlimit !== undefined && bestPeriod.averagePrice > highlimit) {
                priceColorClass = 'price-high'; // Red
            } else if (mediumlimit !== undefined && bestPeriod.averagePrice > mediumlimit) {
                priceColorClass = 'price-medium'; // Orange
            } else if (lowlimit !== undefined && bestPeriod.averagePrice > lowlimit) {
                priceColorClass = 'price-low'; // Dark Green (as per original card's dark green logic)
            } else {
                priceColorClass = 'price-low'; // Green (below low limit)
            }


            htmlContent = `
                <div class="cheapest-period-info ${priceColorClass}">
                    <p><span class="highlight">Cheapest ${durationHours} hour period:</span></p>
                    <div class="period-details">
                        <span>Start: ${startDateFormatted}, ${startTimeFormatted}</span><br>
                        <span>End: ${endDateFormatted}${endTimeFormatted}</span><br>
                        <span>Average Price: ${bestPeriod.averagePrice.toFixed(roundUnits)}${unitstr}</span>
                    </div>
                </div>
            `;

        } else {
            // If no period found (due to maxPrice filter or no valid future periods)
            let finalMessage = noPeriodMessageTemplate.replace('{{ durationHours }}', durationHours);
            if (maxPrice !== undefined) {
                finalMessage = finalMessage.replace('{{ maxPrice }}', maxPrice.toFixed(roundUnits));
                finalMessage = finalMessage.replace('{{ unitstr }}', unitstr);
            } else {
                // Remove the optional part if maxPrice is not defined
                finalMessage = finalMessage.replace(/\{\{ maxPrice !== undefined \? '.*?\{\{ maxPrice \}\}.*?\{\{ unitstr \}\}.*?' : '' \}\}/, '');
            }

            htmlContent = `<p class="no-period">${finalMessage}</p>`;
        }

        this.content.innerHTML = htmlContent;
    }

    setConfig(config) {
        if (!config.currentEntity && !config.futureEntity) {
            throw new Error('You need to define at least one of currentEntity or futureEntity');
        }
        if (config.durationHours === undefined) {
            throw new Error('You need to define durationHours');
        }

        // Combine default configuration with user configuration
        const defaultConfig = {
            title: 'Cheapest Period',
            unitstr: 'p/kWh',
            multiplier: 100,
            roundUnits: 2,
            hour12: false, // Default to 24 hour format
            lowlimit: 5, // Used for coloring the result (in configured unitstr)
            mediumlimit: 20, // Used for coloring the result (in configured unitstr)
            highlimit: 30, // Used for coloring the result (in configured unitstr)
            maxPrice: undefined, // Optional: Maximum acceptable average price (in configured unitstr)
            noPeriodMessage: "No suitable {{ durationHours }} hour period found{{ maxPrice !== undefined ? ' below {{ maxPrice }}{{ unitstr }}' : '' }}.", // Message if no period found. Placeholders supported.
            cardRefreshIntervalSeconds: 60 // How often the card should refresh
        };

        this._config = {
            ...defaultConfig,
            ...config,
        };
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    getCardSize() {
        // Estimate card size based on content lines
        return 3; // Reduced slightly due to more compact display
    }
}

customElements.define('octopus-cheapest-period-card', OctopusCheapestPeriodCard);

// Configure the preview in the Lovelace card picker
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'octopus-cheapest-period-card',
    name: 'Octopus Cheapest Period Card',
    preview: false, // Set to true if you want a preview in the picker
    description: 'Finds the cheapest upcoming period of a specified duration for Octopus Energy rates.',
});
