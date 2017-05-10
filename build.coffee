recursive = require('recursive-readdir')
fs = require('fs')
marked = require('marked')
hcl2json = require('hcl-to-json')
child_process = require('child_process')
json2yml = require('json2yaml')
fuzzy = require('fuzzy')
path = require('path')
getTokenFromMarkdown = require('./utils/getTokenFromMarkdown')


replaceHclToYaml = (title, str) ->

  str.replace(/---(.*?(\n))+.*---/g, '').replace(/\.\.\./g, '# ...').replace /```(hcl|)(\n(?:\n|.)*?)```/g, (match) ->
    match = match.replace(/\`\`\`(hcl|)/g, '')
    if /^\n\$/.test(match)
      return '```bash\n' + match + '\n```'
    try
      return '```yaml' + json2yml.stringify(hcl2json(match)).replace(/^---/, '') + '\n```'
    catch err
      console.log 'Failed on title:', title
      return match
    return


recreateDocs = (callback) ->

  child_process.execSync 'git clone https://github.com/hashicorp/terraform.git --depth 1; rm -rf ./terraform/.git'
  recursive 'terraform/website/source/docs/providers', (err, files) ->

    content = []
    files.forEach (path, k) ->
      data = fs.readFileSync(path, 'utf-8')
      if path.indexOf('.md') > 0 or path.indexOf('.markdown') > 0
        title = data.substring(data.indexOf('page_title:') + 13, data.indexOf('sidebar_current:') - 2)
        description = getTokenFromMarkdown(data, [
          'heading'
          'code'
        ]).trim()
        return content.push(
          value: title
          path: path
          data: replaceHclToYaml(title, data)
          description: description
          marked: marked(data))


    child_process.execSync 'rm -rf ./terraform', cwd: __dirname
    fs.writeFileSync './website/docs.json', JSON.stringify(content, null, '\u0009')
    fs.writeFileSync './docs.json', JSON.stringify(content, null, '\u0009')
    callback null


docs = JSON.parse(fs.readFileSync(path.join(__dirname, './docs.json')))


searchDocs = (query) ->

  results = []
  docs.forEach (content) ->
    if content.data.indexOf(query) > 0
      return results.push([ content.path ])
    return
  results


getContent = (title) ->

  content = null
  length = docs.length
  i = 0

  while i < length
    doc = docs[i]
    if docs[i].value == title
      content = docs[i].data
      break
    i++

  return content


search = (query) ->

  options =
    pre: ''
    post: ''
    extract: (el) ->
      el.value
  results = fuzzy.filter(query, docs, options)
  return results.map (el) ->
    { title: el.string, description: el.original.description }


module.exports =
  recreateDocs: recreateDocs
  searchDocs: searchDocs
  search: search
  getContent: getContent
