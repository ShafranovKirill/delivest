#!/bin/sh
set -eu

last=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)

if [ -z "$last" ]; then
  version=${FIRST_VERSION:-1.0.0}
else
  subjects=$(git log --format=%s "$last..HEAD")
  bodies=$(git log --format=%b "$last..HEAD")
  set -- $(echo "${last#v}" | tr . ' ')
  major=$1 minor=$2 patch=$3

  if echo "$subjects" | grep -Eq '^[a-z]+(\([^)]*\))?!:' || echo "$bodies" | grep -q '^BREAKING CHANGE'; then
    major=$((major + 1)) minor=0 patch=0
  elif echo "$subjects" | grep -Eq '^feat(\([^)]*\))?:'; then
    minor=$((minor + 1)) patch=0
  else
    patch=$((patch + 1))
  fi

  version="$major.$minor.$patch"
fi

echo "version=$version"
echo "minor=${version%.*}"
