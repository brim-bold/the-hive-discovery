# The Hive Discovery — Resource Library

A professional membership community app for educators to discover and curate open educational resources by competency area.

## Features

- **Library** — Browse all resources, filter by competency, resource type, and keyword. Bookmark favorites.
- - **Discover** — Live results from ERIC (U.S. Dept of Education), Google Books, OER Commons, MERLOT, and YouTube — filtered by competency.
  - - **Ask the Hive** — AI assistant powered by Claude, voiced as the Hive mentor.
    - - **Submit a Resource** — Any member can submit a resource with title, URL, type, competency tag, and description.
      - - **Admin** — Pending review queue with approve/reject controls and stats dashboard.
       
        - ## Tech Stack
       
        - - React 18 + Vite
          - - Inline styles with The Hive brand system (Marigold, Ink, Parch, Sand, Herb, Chili, Plum)
            - - Syne font
              - - localStorage persistence for bookmarks and API keys
                - - Live API integrations: ERIC, Google Books, OER Commons, MERLOT, YouTube
                 
                  - ## Getting Started
                 
                  - ```bash
                    npm install
                    npm run dev
                    ```

                    Then open http://localhost:5173

                    ## API Keys (Optional)

                    The app works out of the box with ERIC and Google Books (no keys required). For full functionality:

                    - **YouTube Data API v3** — Get a free key from [Google Cloud Console](https://console.cloud.google.com) → Enable YouTube Data API v3 → Create credentials → API key
                    - - **OER Commons** — Request a free API key at [oercommons.org/oercommons-api-information](https://oercommons.org/oercommons-api-information)
                      - - **MERLOT** — Create a free account at [merlot.org](https://merlot.org) and find your API key in profile settings
                       
                        - Once you have keys, enter them in the **Discover** tab's API key setup fields — they'll save to localStorage automatically.
                       
                        - ## Competency Areas
                       
                        - 1. AI Literacy
                          2. 2. Discovery
                             3. 3. Representation
                                4. 4. Educator Wellness
                                   5. 5. Community Building
                                      6. 6. Curriculum Design
                                        
                                         7. ## License
                                        
                                         8. Built for The Hive Community Space. All rights reserved.
