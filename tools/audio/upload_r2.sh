#!/bin/zsh
# public/audio의 음성 파일을 R2 버킷(langshort-audio)의 audio/ 아래로 올려요. 이미 올린 건 .r2_done 기록을 보고 건너뛰어요.
# 사용: zsh tools/audio/upload_r2.sh   (wrangler 로그인 필요, 끊겨도 다시 실행하면 이어서)
# 동시 8개: Cloudflare API는 5분에 1,200번 제한(429)이라 12개 이상이면 넘어요. 넘으면 실패한 것만 다시 실행.
# manifest.json은 바뀌니까 짧게 캐시(5분), 음성 파일은 이름이 내용으로 정해져서 1년 캐시.
HERE=${0:A:h}
ROOT=$HERE/../..
AUDIO=$ROOT/shorts-react/public/audio
DONE=$HERE/.r2_done
WR="npx --prefix $ROOT/ai-call-worker wrangler"
touch $DONE
cd $AUDIO
ls *.m4a | sort | comm -23 - <(sort $DONE) > /tmp/r2_todo.$$
echo "올릴 파일 $(wc -l < /tmp/r2_todo.$$)개"
export WR DONE
cat /tmp/r2_todo.$$ | xargs -P 8 -n 1 zsh $HERE/r2_put_one.sh
rm /tmp/r2_todo.$$
$=WR r2 object put langshort-audio/audio/manifest.json --file manifest.json --content-type application/json --cache-control "public, max-age=300" --remote >/dev/null 2>&1 && echo "manifest 올림" || echo "실패: manifest"
echo "끝: $(wc -l < $DONE)개 올림"
