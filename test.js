const { strict: assert } = require('assert');
const { handler } = require('./early-resolve');

process.env.TEST = true;

const template = {
  "accountId": "1234567890",
  "fragment": {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "early-resolve-test",
    "Parameters": {
      "Environment": {
        "Type": "String"
      }
    },
    "Resources": {
      "SampleResource": {
        "Type": "AWS::None::Resource",
        "Properties": {
          "SimpleResolve": "{{early-resolve:ssm:/${Environment}/infra/sample-resolve}}",
          "DefaultResolve": "{{early-resolve-with-default:ssm:/${Environment}/infra/default-resolve|default}}",
          "DefaultResolveEmpty": "{{early-resolve-with-default:ssm:/${Environment}/infra/default-resolve}}",
          "ArrayResolve": [
            "partially-{{early-resolve:ssm:/${Environment}/infra/resource-arn}}"
          ],
          "ArrayMultiResolve": [
            {
              "Key": "melio:early-resolve-test-1",
              "Value": "multi-key-1-{{early-resolve:ssm:/${Environment}/infra/hello}}"
            },
            {
              "Key": "melio:early-resolve-test-2",
              "Value": "multi-key-2-{{early-resolve:ssm:/${Environment}/infra/hello}}"
            }
          ]
        }
      }
    }
  },
  "transformId": "1234567890::EarlyResolve",
  "requestId": "b7af92d7-d0fd-4fb7-a5b5-614deb2c36be",
  "region": "eu-central-1",
  "params": {},
  "templateParameterValues": {
    "Environment": "sample-environment"
  }
};

// Handle a duplicated object so that we can compare
handler(JSON.parse(JSON.stringify(template)), {}).then((result) => {
  assert(result.fragment.Resources.SampleResource.Properties.SimpleResolve === 'mocked', 'Failed to resolve SimpleValue');
  assert(result.fragment.Resources.SampleResource.Properties.DefaultResolve === 'default', 'Failed to resolve default value');
  assert(result.fragment.Resources.SampleResource.Properties.DefaultResolveEmpty === '', 'Failed to resolve default empty value');
  assert(result.fragment.Resources.SampleResource.Properties.ArrayResolve[0] === 'partially-mocked', 'Failed to resolve array');
  assert(result.fragment.Resources.SampleResource.Properties.ArrayMultiResolve[0].Value === 'multi-key-1-mocked', 'Failed to resolve multi array 1');
  assert(result.fragment.Resources.SampleResource.Properties.ArrayMultiResolve[1].Value === 'multi-key-2-mocked', 'Failed to resolve multi array 2');
});
