EarlyResolve Macro
==================

Performs an "early resolve" instead of the built-in dynamic `resolve`. It runs on the template compilation and replaces
the relevant values. Skip to [early resolve vs dynamic resolve](#difference-from-current-dynamic-resolve)

Usage
-----

1. Create the stack from `early-resolve.template.json`.
2. Add the Macro in a "Transform" in your own CloudFormation template.
3. Place `{{early-resolve:ssm:...}}` anywhere in the template.
4. Optionally reference template parameters, see "${Environment}" in the example. This is similar to `!Sub` directive.
5. Create/update the stack.

```yaml
Transform:
  - AWS::Serverless-2016-10-31
  - EarlyResolve

Parameters:
  Environment:
    Type: String

Resources:
  SomeResource:
    Type: AWS::Resource::Type
    Properties:
      PropKey: "{{early-resolve:ssm:/${Environment}/infra/vpc-id}}"
```

Supported resolvers
-------------------

There is only one supported resolver in here which resolves SSM (Parameter Store) parameters.

```
{{early-resolve:ssm:<path-to-param>}}
```

Where `<path-to-param>` can mix strings and template parameter references, for example:

```
{{early-resolve:ssm:/path/${AnyParameter}/value}}
```

The parameter replacement happens in this Macro, hence you do not need to `!Sub` it.

Building
--------

This is meant to be a standalone template that deploys the Macro. The code resides in `early-resolve.js`, after
updating it, please run `npm run build` and only then commit your changes.

```shell
# Make code changes
# Run the tests
$ npm install
$ npm test

# Build
$ npm run build

# This will modify the early-resolve.template.json with the changes.
```

Difference from current dynamic resolve
---------------------------------------

CloudFormation supports resolving values from several resources using [dynamic resolve](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/dynamic-references.html).
Take this template snippet for example:

```yaml
Resources:
  MyFunction:
    Type: AWS::Lambda::Function
    Properties:
      Environment:
        Variables:
          DATABASE_HOST: {{resolve:ssm:/infra/parameters/database-host}} 
```

Dynamic resolve helps us build templates that fetch configuration from the surrounding environment. It's a very
powerful feature that allows the template to discover the environment with conventions and agreement on predefined
locations, and it also doesn't "lock" the reference as opposed to `Fn::ImportValue`.

Dynamic resolves happen at the end of the template lifecycle, i.e. after CloudFormation decided which resources
should be modified or created. There is, however, a few problem with this approach.

### Updates are not possible

Because of this late-stage update, modifying the SSM parameter (in the above example) and then re-applying the same
template will not trigger an update to the resource, causing the value to stay the same. This presents a problem if
you want to modify the value, and let the dependant resources converge at their own pace.

You could trigger an update, but you need to manually modify the resource so that CloudFormation triggers an update for
it. This is normally not a good approach, and you don't always have a way to trigger it.

### Pseudo functions are not available

Another issue of the resolving happening at the end of the template lifecycle is that intrinsic functions run *before*
the resolving happens. So if you want, for example, to use a `Fn::Split` or `Fn::Join` it's simply not possible.

For example, given an SSM parameter with the value `subnet-7b5b4112,subnet-7b5b4115` the following *will not* resolve
as expected:

```yaml
Resources:
  MySubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Sample RDS subnet group
      SubnetIds: !Split [ ",", "{{resolve:ssm:/infra/vpc/private-subnets}}" ]
```

While you expect this to resolve to:

```yaml
Resources:
  MySubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Sample RDS subnet group
      SubnetIds:
        - subnet-7b5b4112
        - subnet-7b5b4115
```

You actually get:

```yaml
Resources:
  MySubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Sample RDS subnet group
      SubnetIds:
        - subnet-7b5b4112,subnet-7b5b4115

        # !Split creates an array, but of one value which contains the {{resolve..}} string
        # This string eventually resolves to the value that is stored in the SSM
```

Complete example
----------------

This is the reason why we created the early resolve Macro. It will perform the resolve when the template passes through
it, effectively modifying the template to fetch updated values.

So, combining the above two examples into one we get:

```yaml
Transform:
  - EarlyResolve

Parameters:
  Environment:
    Type: String

Resources:
  MyFunction:
    Type: AWS::Lambda::Function
    Properties:
      Environment:
        Variables:
          DATABASE_HOST: {{early-resolve:ssm:/infra/database-host}}
      VpcConfig:
        SubnetIds: !Split [ ",", "{{early-resolve:ssm:/${Environment}/vpc/private-subnets}}" ]

  MySecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Sample security group
      VpcId: "{{early-resolve:ssm:/${Environment}/vpc/id}}"
```

Assuming these parameters are set, we can re-deploy our stack and stay up to date if these details change, plus we can
also use intrinsic functions on them.
