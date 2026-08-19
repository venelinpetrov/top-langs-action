# Setup

1. Generate classic token. Go to `https://github.com/settings/tokens`. The only required permission is `repo.public_repo`.
2. Add `GH_PAT` variable in `https://github.com/<username>/<username>/settings/secrets/actions`
3. Add a workflow in `.github/workflows` in your repo

```yml
name: Update README cards

on:
  schedule:
    - cron: "0 0 */5 * *"
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v6

      - name: Generate top languages card
        uses: venelinpetrov/top-langs-action@master
        with:
          github_token: ${{ secrets.GH_PAT }}
          top_n: 11
          output_path: profile/top-langs.svg

      - name: Commit cards
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add profile/*.svg
          git commit -m "Update README cards" || exit 0
          git push
```
