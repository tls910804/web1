#!/bin/zsh
# upload_r2.sh가 파일 하나씩 부르는 도우미 (xargs 명령 길이 제한 때문에 따로 둠)
$=WR r2 object put "langshort-audio/audio/$1" --file "$1" --content-type audio/mp4 --cache-control "public, max-age=31536000, immutable" --remote >/dev/null 2>&1 && echo "$1" >> $DONE || echo "실패: $1"
