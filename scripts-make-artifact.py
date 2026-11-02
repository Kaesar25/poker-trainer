import re
html=open('dist-artifact/index.html').read()
head=re.search(r'<head>(.*?)</head>',html,re.S).group(1)
body=re.search(r'<body>(.*?)</body>',html,re.S).group(1)
keep=re.findall(r'<meta name="viewport"[^>]*>|<link[^>]*fonts[^>]*>|<title>.*?</title>|<style[^>]*>.*?</style>|<script[^>]*>.*?</script>',head,re.S)
out='\n'.join(keep)+'\n'+body
open('artifact.html','w').write(out)
print(len(out), 'style' , out.count('<style'), 'script', out.count('<script'))
