var child_process, docs, fs, fuzzy, hcl2json, json2yml, marked, recreateDocs, recursive, replaceHclToYaml, search, getContent, searchDocs, getTokenFromMarkdown;

recursive = require('recursive-readdir');
fs = require('fs');
marked = require('marked');
hcl2json = require("hcl-to-json");
child_process = require('child_process');
json2yml = require('json2yaml');
fuzzy = require("fuzzy");
path = require('path');
getTokenFromMarkdown = require('./utils/getTokenFromMarkdown');

replaceHclToYaml = function(title, str) {

  return str
    .replace(/---(.*?(\n))+.*---/g, '')
    .replace(/\.\.\./g, "# ...")
    .replace(/```(hcl|)(\n(?:\n|.)*?)```/g, function (match) {
      match = match.replace(/\`\`\`(hcl|)/g, '');
      if (/^\n\$/.test(match)) {
        return "```bash\n" + match + "\n```";
      }
      try {
        return '```yaml' + json2yml.stringify(hcl2json(match)).replace(/^---/,'') + '\n```';
      } catch (err) {
        console.log('Failed on title:', title);
        return match;
      }
    });

};

recreateDocs = function(callback) {
  child_process.execSync("git clone https://github.com/hashicorp/terraform.git --depth 1; rm -rf ./terraform/.git");
  return recursive('terraform/website/source/docs/providers', function(err, files) {
    var content;
    content = [];
    files.forEach(function(path, k) {
      var data, title, description;
      data = fs.readFileSync(path, 'utf-8');
      if (path.indexOf(".md") > 0 || path.indexOf(".markdown") > 0) {
        title = data.substring(data.indexOf('page_title:') + 13, data.indexOf('sidebar_current:') - 2);
        description = getTokenFromMarkdown(data, ['heading', 'code']).trim();
        return content.push({
          value: title,
          path: path,
          data: replaceHclToYaml(title, data),
          description: description,
          marked: marked(data)
        });
      }
    });

    child_process.execSync("rm -rf ./terraform", { cwd: __dirname} );
    fs.writeFileSync("./website/docs.json", JSON.stringify(content, null, "\t"));
    fs.writeFileSync("./docs.json", JSON.stringify(content, null, "\t"));
    return callback(null);
  });
};

docs = JSON.parse(fs.readFileSync(path.join(__dirname, "./docs.json")));

searchDocs = function(query) {
  var results;
  results = [];
  docs.forEach(function(content) {
    if (content.data.indexOf(query) > 0) {
      return results.push([content.path]);
    }
  });
  return results;
};

getContent = function(title){
  var content = null;
  length = docs.length;
  for (var i=0; i<length; i++){
    var doc = docs[i];
    if(docs[i].value == title){
      content = docs[i].data;
      break;
    }
  }
  return content;
};

search = function(query) {
  var matches, options, results;
  options = {
    pre: '',
    post: '',
    extract: function(el) {
      return el.value;
    }
  };
  results = fuzzy.filter(query, docs, options);
  matches = results.map(function(el) {
    return({title: el.string, description: el.original.description});
  });
  return matches;
};

module.exports = {
  recreateDocs: recreateDocs,
  searchDocs: searchDocs,
  search: search,
  getContent: getContent
};