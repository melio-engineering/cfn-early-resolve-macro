const AWS = require('aws-sdk');

const ssm = new AWS.SSM();
let ssmCache;

// A slightly modified version of https://dev.to/ycmjason/stringprototypereplace-asynchronously-28k9
// without the Promise.all to not parallelize the SSM calls.
const asyncStringReplace = async (str, regex, aReplacer) => {
  const substrs = [];
  let match, i = 0;
  while ((match = regex.exec(str)) !== null) {
    substrs.push(str.slice(i, match.index));
    substrs.push(await aReplacer(...match));
    i = regex.lastIndex;
  }
  substrs.push(str.slice(i));
  return substrs.join('');
};

function replaceParams(str, params) {
  let replaced = str;
  for (const [key, value] of Object.entries(params)) {
    // Replace ${key} with value, for example ${Environment}
    replaced = replaced.replace(`\${${key}}`, value);
  }
  return replaced;
}

async function getSSMParameter(parameter) {
  if (parameter in ssmCache) {
    console.log('Using cached parameter', parameter);
  } else {
    let ret;
    if (process.env.TEST) {
      ret = 'mocked';
    } else {
      const param = await ssm.getParameter({
        Name: parameter,
        WithDecryption: true
      }).promise();
      ret = param.Parameter.Value;
    }
    ssmCache[parameter] = ret;
  }

  return ssmCache[parameter];
}

async function deepReplace(object, params) {
  if (object === null || typeof object === 'boolean' || typeof object === 'number') {
    return object;
  }

  if (typeof object === 'string') {
    return await asyncStringReplace(object, /\{\{early-resolve:ssm:(.*?)\}\}/g, async (match, ssmParameter) => {
      const parameterName = replaceParams(ssmParameter, params);
      console.log("Resolving parameter:", match, ssmParameter, parameterName);
      return getSSMParameter(parameterName);
    });
  }

  if (typeof object === 'object') { // Either array or object
    for (const key in object) {
      object[key] = await deepReplace(object[key], params);
    }
    return object;
  }

  return object;
}

exports.handler = async (event, context) => {
  ssmCache = {};

  console.log("Parsing event:", JSON.stringify(event));
  const template = event["fragment"] || {};
  const params = event["templateParameterValues"] || {};
  const resolvedTemplate = await deepReplace(template, params);

  return {
    requestId: event["requestId"],
    status: "success",
    fragment: resolvedTemplate,
  }
}
