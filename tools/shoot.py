# Screenshots + console-error check (needs playwright: /tmp/pwv/bin/python tools/shoot.py)
from playwright.sync_api import sync_playwright
import sys
URL=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8792/web/'
OUT='/home/box/pokemon-team/design/build1/'
PAGES=[('deals','#/deals'),('radar','#/radar'),('card','#/card/30c-en-lugia-149-147'),('team','#/team'),('cards','#/cards')]
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for dev,ctx in [('desktop',dict(viewport={'width':1280,'height':900})),('phone',dict(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True))]:
        c=b.new_context(**ctx);pg=c.new_page()
        pg.on('console',lambda m,d=dev:m.type in('error','warning') and errs.append(f'{d} {m.type}: {m.text}'))
        pg.on('pageerror',lambda e,d=dev:errs.append(f'{d} pageerror: {e}'))
        for n,h in PAGES:
            pg.set_viewport_size(ctx['viewport']);pg.goto(URL+h);pg.wait_for_selector('main',timeout=15000);pg.wait_for_timeout(1200)
            if dev=='phone':
                pg.set_viewport_size({'width':390,'height':pg.evaluate('document.documentElement.scrollHeight')});pg.wait_for_timeout(300)
            pg.screenshot(path=f'{OUT}{n}-{dev}.png',full_page=True)
        c.close()
    b.close()
print('console issues:',errs or 'none')

# Supabase path smoke test: must reach the sign-in screen with no console errors.
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page();e2=[]
    pg.on('console',lambda m:m.type=='error' and e2.append(m.text));pg.on('pageerror',lambda e:e2.append(str(e)))
    pg.goto(URL+'?backend=supabase#/deals');pg.wait_for_selector('#si',timeout=20000);pg.screenshot(path=OUT+'signin-supabase.png')
    print('supabase path: sign-in screen OK; console errors:',e2 or 'none');b.close()
