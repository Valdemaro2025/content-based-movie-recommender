// Initialize the application when the window loads
window.onload = async function() {
    try {
        // Display loading message
        const resultElement = document.getElementById('result');
        resultElement.textContent = "Loading movie data...";
        resultElement.className = 'loading';

        // Load data
        await loadData();

        // Populate dropdowns and update status
        populateMoviesDropdown();
        resultElement.textContent = "Data loaded. Please select a movie.";
        resultElement.className = 'success';
    } catch (error) {
        console.error('Initialization error:', error);
        // Error message already set in data.js
    }
};

// Populate the movie dropdowns with sorted movie titles
function populateMoviesDropdown() {
    const selectIds = ['movie-select', 'watched-1', 'watched-2', 'watched-3'];

    // Sort movies alphabetically by title
    const sortedMovies = [...movies].sort((a, b) => a.title.localeCompare(b.title));

    selectIds.forEach(selectId => {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) return;

        // Clear existing options except the first placeholder
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }

        // Add movies to dropdown
        sortedMovies.forEach(movie => {
            const option = document.createElement('option');
            option.value = movie.id;
            option.textContent = movie.title;
            selectElement.appendChild(option);
        });
    });
}

// Normalized cosine similarity between two 18-dimensional feature vectors.
// dot = sum(a[i] * b[i]); normA = sqrt(sum(a[i]^2)); normB = sqrt(sum(b[i]^2)).
// Returns 0 if either norm is 0, otherwise dot / (normA * normB).
function cosineSimilarity(a, b) {
    let dot = 0;
    let sumSqA = 0;
    let sumSqB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        sumSqA += a[i] * a[i];
        sumSqB += b[i] * b[i];
    }

    const normA = Math.sqrt(sumSqA);
    const normB = Math.sqrt(sumSqB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dot / (normA * normB);
}

// Rank candidates by cosine similarity to a query vector and return Top-N.
function getTopN(queryVector, excludeIds, topN) {
    const excludeSet = new Set(excludeIds);

    const scoredMovies = movies
        .filter(movie => !excludeSet.has(movie.id))
        .map(candidate => ({
            id: candidate.id,
            title: candidate.title,
            genres: candidate.genres,
            vector: candidate.vector,
            score: cosineSimilarity(queryVector, candidate.vector),
            ratingCount: getRatingCount(candidate.id)
        }));

    scoredMovies.sort((a, b) => b.score - a.score);

    return scoredMovies.slice(0, topN);
}

// Log a Top-N list as a console.table for audit purposes.
function logTopN(mode, topList) {
    console.table(topList.map((movie, index) => ({
        rank: index + 1,
        id: movie.id,
        title: movie.title,
        genres: movie.genres.join(', '),
        cosineScore: Number(movie.score.toFixed(4)),
        ratingCount: movie.ratingCount
    })), ['rank', 'id', 'title', 'genres', 'cosineScore', 'ratingCount']);
    console.log(mode + ' Top-5 IDs:', topList.map(movie => movie.id));
}

// Render a Top-N list into a result paragraph.
function renderTopN(resultElement, header, topList) {
    const lines = topList.map((movie, index) => {
        const genreText = movie.genres.length > 0 ? movie.genres.join(', ') : 'no genres listed';
        return `${index + 1}. ${movie.title} (score: ${movie.score.toFixed(4)}, genres: ${genreText}, ratings: ${movie.ratingCount})`;
    });
    resultElement.textContent = header + lines.join(' | ');
    resultElement.className = 'success';
}

// Item-to-Item mode: one selected movie -> cosine similarity -> Top-5
function getRecommendations() {
    const resultElement = document.getElementById('result');

    try {
        // Step 1: Get user input
        const selectElement = document.getElementById('movie-select');
        const selectedMovieId = parseInt(selectElement.value);

        if (isNaN(selectedMovieId)) {
            resultElement.textContent = "Please select a movie first.";
            resultElement.className = 'error';
            return;
        }

        // Step 2: Find the liked movie
        const likedMovie = movies.find(movie => movie.id === selectedMovieId);
        if (!likedMovie) {
            resultElement.textContent = "Error: Selected movie not found in database.";
            resultElement.className = 'error';
            return;
        }

        // Show loading message while processing
        resultElement.textContent = "Calculating recommendations...";
        resultElement.className = 'loading';

        // Use setTimeout to allow the UI to update before heavy computation
        setTimeout(() => {
            try {
                const topRecommendations = getTopN(likedMovie.vector, [likedMovie.id], 5);

                // Overlap check: recommendations must not contain the input movie.
                const topIds = topRecommendations.map(movie => movie.id);
                const overlap = topIds.filter(id => id === likedMovie.id);
                console.assert(overlap.length === 0, 'Item-to-Item overlap check failed', overlap);
                console.log('Item-to-Item liked ID:', likedMovie.id, 'Top-5 IDs:', topIds, 'Overlap:', overlap);

                logTopN('Item-to-Item', topRecommendations);

                if (topRecommendations.length > 0) {
                    renderTopN(resultElement, `Because you liked "${likedMovie.title}", we recommend: `, topRecommendations);
                } else {
                    resultElement.textContent = `No recommendations found for "${likedMovie.title}".`;
                    resultElement.className = 'error';
                }
            } catch (error) {
                console.error('Error in recommendation calculation:', error);
                resultElement.textContent = "An error occurred while calculating recommendations.";
                resultElement.className = 'error';
            }
        }, 100);
    } catch (error) {
        console.error('Error in getRecommendations:', error);
        resultElement.textContent = "An unexpected error occurred.";
        resultElement.className = 'error';
    }
}

// Profile-Based mode: average of three watched movie vectors -> cosine similarity -> Top-5
function getProfileRecommendations() {
    const resultElement = document.getElementById('profile-result');

    try {
        const watchedIds = ['watched-1', 'watched-2', 'watched-3'].map(selectId => {
            const el = document.getElementById(selectId);
            return parseInt(el.value);
        });

        if (watchedIds.some(id => isNaN(id))) {
            resultElement.textContent = "Please select three watched movies first.";
            resultElement.className = 'error';
            return;
        }

        if (new Set(watchedIds).size !== watchedIds.length) {
            resultElement.textContent = "Please select three different movies. Duplicates are not allowed.";
            resultElement.className = 'error';
            return;
        }

        const watchedMovies = watchedIds.map(id => movies.find(movie => movie.id === id));
        if (watchedMovies.some(movie => !movie)) {
            resultElement.textContent = "Error: One of the watched movies was not found in the database.";
            resultElement.className = 'error';
            return;
        }

        resultElement.textContent = "Calculating profile recommendations...";
        resultElement.className = 'loading';

        setTimeout(() => {
            try {
                // Build the profile vector as the element-wise mean of the three watched vectors.
                const dimensions = watchedMovies[0].vector.length;
                const profileVector = [];
                for (let i = 0; i < dimensions; i++) {
                    profileVector.push((watchedMovies[0].vector[i] + watchedMovies[1].vector[i] + watchedMovies[2].vector[i]) / watchedMovies.length);
                }

                // Profile norm for audit (profile averaging behavior).
                let profileSumSq = 0;
                for (let i = 0; i < profileVector.length; i++) {
                    profileSumSq += profileVector[i] * profileVector[i];
                }
                const profileNorm = Math.sqrt(profileSumSq);

                console.log('Profile vector (18-dim mean):', profileVector);
                console.log('Profile norm:', profileNorm);

                // Cosine similarity between each watched movie vector and the averaged profile.
                watchedMovies.forEach(movie => {
                    console.log(`cosine(watched id ${movie.id} "${movie.title}", profile) =`, cosineSimilarity(movie.vector, profileVector).toFixed(4));
                });

                const topRecommendations = getTopN(profileVector, watchedIds, 5);

                // Overlap check: Top-5 must not contain any watched movie.
                const topIds = topRecommendations.map(movie => movie.id);
                const watchedSet = new Set(watchedIds);
                const overlap = topIds.filter(id => watchedSet.has(id));
                console.assert(overlap.length === 0, 'Profile overlap check failed', overlap);
                console.log('Watched IDs:', watchedIds, 'Top-5 IDs:', topIds, 'Overlap:', overlap);

                logTopN('Profile-Based', topRecommendations);

                if (topRecommendations.length > 0) {
                    const watchedTitles = watchedMovies.map(movie => `"${movie.title}"`).join(', ');
                    renderTopN(resultElement, `Because you watched ${watchedTitles}, we recommend: `, topRecommendations);
                } else {
                    resultElement.textContent = "No profile recommendations found.";
                    resultElement.className = 'error';
                }
            } catch (error) {
                console.error('Error in profile recommendation calculation:', error);
                resultElement.textContent = "An error occurred while calculating profile recommendations.";
                resultElement.className = 'error';
            }
        }, 100);
    } catch (error) {
        console.error('Error in getProfileRecommendations:', error);
        resultElement.textContent = "An unexpected error occurred.";
        resultElement.className = 'error';
    }
}
