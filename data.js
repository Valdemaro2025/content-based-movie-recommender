// Global variables for storing movie and rating data
let movies = [];
let ratings = [];
let ratingCount = {};

// Genre names as defined in the u.item file
const genreNames = [
    "Action", "Adventure", "Animation", "Children's", "Comedy",
    "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir",
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
];

// Primary function to load data from files
async function loadData() {
    try {
        // Load and parse movie data
        const moviesResponse = await fetch('u.item');
        if (!moviesResponse.ok) {
            throw new Error(`Failed to load movie data: ${moviesResponse.status}`);
        }
        const moviesText = await moviesResponse.text();
        parseItemData(moviesText);

        // Load and parse rating data
        const ratingsResponse = await fetch('u.data');
        if (!ratingsResponse.ok) {
            throw new Error(`Failed to load rating data: ${ratingsResponse.status}`);
        }
        const ratingsText = await ratingsResponse.text();
        parseRatingData(ratingsText);
    } catch (error) {
        console.error('Error loading data:', error);
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.textContent = `Error: ${error.message}. Please make sure u.item and u.data files are in the correct location.`;
            resultElement.className = 'error';
        }
        throw error; // Re-throw to allow script.js to handle the error
    }
}

// Parse movie data from u.item format
function parseItemData(text) {
    const lines = text.split('\n');
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const fields = line.split('|');
        if (fields.length < 5) continue; // Skip invalid lines
        
        const id = parseInt(fields[0]);
        const title = fields[1];
        
        // Extract genres (fields 6-23: Action through Western, 18 dimensions).
        // Field 5 is the "unknown" flag and is NOT included in the vector.
        const genreValues = fields.slice(6, 24).map(value => parseInt(value));
        const genres = genreNames.filter((_, index) => genreValues[index] === 1);
        const vector = genreValues.map(value => (value === 1 ? 1 : 0));

        movies.push({ id, title, genres, vector });
    }
}

// Parse rating data from u.data format
function parseRatingData(text) {
    const lines = text.split('\n');
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const fields = line.split('\t');
        if (fields.length < 4) continue; // Skip invalid lines
        
        const userId = parseInt(fields[0]);
        const itemId = parseInt(fields[1]);
        const rating = parseFloat(fields[2]);
        const timestamp = parseInt(fields[3]);
        
        ratings.push({ userId, itemId, rating, timestamp });

        // Popularity: ratingCount[itemId] = number of rating rows for that movie.
        ratingCount[itemId] = (ratingCount[itemId] || 0) + 1;
    }
}

// Retrieve the popularity (rating count) for a movie ID.
function getRatingCount(movieId) {
    return ratingCount[movieId] || 0;
}
